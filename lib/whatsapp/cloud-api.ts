import { getWhatsAppConfig } from "@/lib/config/runtime-config"
import { asRecord } from "./utils"

/**
 * Thin WhatsApp Cloud API (Graph) client. Pure transport: it never touches the database
 * and never decides business rules (window, templates, retries live in `send.ts`).
 *
 * Secrets: the access token only ever goes into the Authorization header. Errors are built
 * from Meta's error object (code, message) and a fixed description, never from the request,
 * so a token cannot reach a thrown error or a log line (WC-15).
 */

export const DEFAULT_GRAPH_VERSION = "v25.0"
const GRAPH_HOST = "https://graph.facebook.com"
const REQUEST_TIMEOUT_MS = 30_000
const MAX_ERROR_MESSAGE_LENGTH = 300

export class CloudApiError extends Error {
  readonly name = "CloudApiError"

  constructor(
    message: string,
    /** HTTP status, or null for network failures and unusable responses. */
    readonly status: number | null,
    /** Meta's numeric error code as a string (e.g. "131047"), when the response carried one. */
    readonly code: string | null,
    /** Retryable errors (429, 5xx, timeouts, network) are retried with backoff; the rest are permanent. */
    readonly retryable: boolean
  ) {
    super(message)
  }
}

interface ClientConfig {
  accessToken: string
  phoneNumberId: string
  graphVersion: string
}

function clientConfig(): ClientConfig {
  const { accessToken, phoneNumberId, graphVersion } = getWhatsAppConfig()
  if (!accessToken || !phoneNumberId) {
    throw new CloudApiError("WhatsApp Cloud API is not configured", null, null, false)
  }
  return { accessToken, phoneNumberId, graphVersion: graphVersion ?? DEFAULT_GRAPH_VERSION }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || status >= 500
}

/** Builds a safe error from a non-2xx response. Never includes headers or the request body. */
async function errorFromResponse(response: Response, token: string): Promise<CloudApiError> {
  let metaMessage = ""
  let code: string | null = null
  try {
    const body = asRecord(await response.json())
    const error = asRecord(body?.error)
    if (typeof error?.message === "string") metaMessage = error.message
    if (error?.code != null) code = String(error.code)
  } catch {
    // Non-JSON error body: fall back to the status alone.
  }

  const detail = metaMessage.split(token).join("[redacted]").slice(0, MAX_ERROR_MESSAGE_LENGTH)
  const message = `WhatsApp Cloud API responded ${response.status}${code ? ` (code ${code})` : ""}${detail ? `: ${detail}` : ""}`
  return new CloudApiError(message, response.status, code, isRetryableStatus(response.status))
}

async function request(path: string, init: RequestInit, config: ClientConfig): Promise<Response> {
  const url = path.startsWith("http") ? path : `${GRAPH_HOST}/${config.graphVersion}/${path}`
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${config.accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    // Deliberately drops the underlying error: its message or cause may echo request details.
    throw new CloudApiError("Network error calling WhatsApp Cloud API", null, null, true)
  }
  if (!response.ok) throw await errorFromResponse(response, config.accessToken)
  return response
}

async function postJson(path: string, body: unknown, config: ClientConfig): Promise<unknown> {
  const response = await request(
    path,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    config
  )
  return response.json().catch(() => {
    throw new CloudApiError("WhatsApp Cloud API returned an unreadable response", response.status, null, false)
  })
}

export interface SendResult {
  /** Provider message id (wamid) Meta assigned to the accepted message (WC-11). */
  wamid: string
}

function wamidFrom(body: unknown): SendResult {
  const messages = asRecord(body)?.messages
  const first = Array.isArray(messages) ? asRecord(messages[0]) : null
  if (typeof first?.id !== "string" || first.id.length === 0) {
    // Accepted but unidentifiable: retrying could double-send, so this is permanent.
    throw new CloudApiError("WhatsApp Cloud API response had no message id", null, null, false)
  }
  return { wamid: first.id }
}

function messagesPath(config: ClientConfig): string {
  return `${config.phoneNumberId}/messages`
}

interface SendOptions {
  /** wamid of the message being replied to; rendered as a quoted reply. */
  contextWamid?: string | null
}

function withContext(options?: SendOptions): Record<string, unknown> {
  return options?.contextWamid ? { context: { message_id: options.contextWamid } } : {}
}

/** Free-form text. Only valid inside the 24 h window; the caller enforces that (WC-13). */
export async function sendText(to: string, body: string, options?: SendOptions): Promise<SendResult> {
  const config = clientConfig()
  const result = await postJson(
    messagesPath(config),
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body, preview_url: false },
      ...withContext(options),
    },
    config
  )
  return wamidFrom(result)
}

export interface TemplateInput {
  /** Template name as approved in Meta Business Manager. */
  name: string
  language: string
  /** Positional body variables, in {{1}}, {{2}}... order. */
  params: readonly string[]
}

/** Approved template; the only message type allowed outside the 24 h window. */
export async function sendTemplate(to: string, template: TemplateInput): Promise<SendResult> {
  const config = clientConfig()
  const result = await postJson(
    messagesPath(config),
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: template.name,
        language: { code: template.language },
        ...(template.params.length > 0
          ? {
              components: [
                { type: "body", parameters: template.params.map((text) => ({ type: "text", text })) },
              ],
            }
          : {}),
      },
    },
    config
  )
  return wamidFrom(result)
}

export type OutboundMediaKind = "image" | "document"

export interface MediaInput {
  kind: OutboundMediaKind
  bytes: Uint8Array
  mimeType: string
  fileName?: string | null
  caption?: string | null
}

/** Uploads the bytes to `/{phoneId}/media`, then sends the message by media id. */
export async function sendMedia(to: string, media: MediaInput, options?: SendOptions): Promise<SendResult> {
  const config = clientConfig()

  const form = new FormData()
  form.append("messaging_product", "whatsapp")
  form.append("type", media.mimeType)
  form.append("file", new Blob([media.bytes as BlobPart], { type: media.mimeType }), media.fileName ?? "file")
  const uploadResponse = await request(`${config.phoneNumberId}/media`, { method: "POST", body: form }, config)
  const uploaded = asRecord(await uploadResponse.json().catch(() => null))
  if (typeof uploaded?.id !== "string" || uploaded.id.length === 0) {
    throw new CloudApiError("WhatsApp Cloud API upload returned no media id", uploadResponse.status, null, false)
  }

  const object = {
    id: uploaded.id,
    ...(media.caption ? { caption: media.caption } : {}),
    ...(media.kind === "document" && media.fileName ? { filename: media.fileName } : {}),
  }
  const result = await postJson(
    messagesPath(config),
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: media.kind,
      [media.kind]: object,
      ...withContext(options),
    },
    config
  )
  return wamidFrom(result)
}

export interface MediaInfo {
  /** Short-lived download URL. Never persist it or hand it to a browser (MH-1). */
  url: string
  mimeType: string
  sha256: string | null
  fileSize: number | null
}

/** Resolves a media id to a fresh download URL plus metadata. Call it on every attempt (S-MH-6). */
export async function getMediaInfo(mediaId: string): Promise<MediaInfo> {
  const config = clientConfig()
  const response = await request(encodeURIComponent(mediaId), { method: "GET" }, config)
  const body = asRecord(await response.json().catch(() => null))
  if (typeof body?.url !== "string") {
    throw new CloudApiError("WhatsApp Cloud API media lookup returned no url", response.status, null, false)
  }
  return {
    url: body.url,
    mimeType: typeof body.mime_type === "string" ? body.mime_type : "application/octet-stream",
    sha256: typeof body.sha256 === "string" ? body.sha256 : null,
    fileSize: typeof body.file_size === "number" ? body.file_size : null,
  }
}

export interface DownloadedMedia {
  bytes: Uint8Array
  contentType: string | null
}

/**
 * Downloads media bytes from a URL returned by `getMediaInfo` (Bearer auth required).
 * `maxBytes` rejects oversize files from the declared length before reading the body, and
 * again on the actual size.
 */
export async function downloadMedia(url: string, options?: { maxBytes?: number }): Promise<DownloadedMedia> {
  const config = clientConfig()
  // The bearer token must never be sent over plain HTTP or to a non-URL.
  if (!URL.canParse(url) || new URL(url).protocol !== "https:") {
    throw new CloudApiError("Media URL must be an https URL", null, null, false)
  }
  const response = await request(url, { method: "GET" }, config)

  const maxBytes = options?.maxBytes
  const declared = Number(response.headers.get("content-length"))
  if (maxBytes && Number.isFinite(declared) && declared > maxBytes) {
    throw new CloudApiError("Media exceeds the configured size limit", response.status, null, false)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (maxBytes && bytes.byteLength > maxBytes) {
    throw new CloudApiError("Media exceeds the configured size limit", response.status, null, false)
  }
  return { bytes, contentType: response.headers.get("content-type") }
}
