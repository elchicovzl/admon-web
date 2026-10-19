import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

/**
 * Thin Cloudflare R2 helper (S3 API). Credentials come from the same `R2_*` variables the
 * affiliation upload route uses. Nothing here reads env at import time, so `next build`
 * works without secrets; the client is created on first use.
 */

/** Presigned GET lifetime for inbox media (MH-2): 10 minutes. */
export const DEFAULT_PRESIGN_SECONDS = 600
/** S3 DeleteObjects accepts at most 1000 keys per request. */
const DELETE_BATCH_SIZE = 1000

let client: S3Client | undefined

function getClient(): S3Client {
  if (client) return client
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Cloudflare R2 credentials not configured")
  }
  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
  return client
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET_NAME
  if (!bucket) throw new Error("R2_BUCKET_NAME is not configured")
  return bucket
}

/** Drops the cached client (tests, or after rotating credentials). */
export function resetR2Client(): void {
  client = undefined
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  await getClient().send(new PutObjectCommand({ Bucket: getBucket(), Key: key, Body: body, ContentType: contentType }))
}

/** Server-side copy inside the bucket (used to re-key media when it is attached elsewhere). */
export async function copyObject(sourceKey: string, destinationKey: string): Promise<void> {
  const bucket = getBucket()
  await getClient().send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: destinationKey,
      // CopySource is "bucket/key", URL-encoded per path segment.
      CopySource: `${bucket}/${sourceKey.split("/").map(encodeURIComponent).join("/")}`,
    })
  )
}

export interface DeleteObjectsResult {
  /** Keys that are gone: deleted now, or already missing (a missing key counts as success). */
  deleted: string[]
  failed: { key: string; code: string }[]
}

/**
 * Deletes keys in batches. Never throws for per-key failures: the caller (retention purge)
 * keeps the DB rows of every key listed in `failed` and retries on its next run. A request
 * that fails as a whole marks that batch's keys as failed.
 */
export async function deleteObjects(keys: string[]): Promise<DeleteObjectsResult> {
  const result: DeleteObjectsResult = { deleted: [], failed: [] }
  const unique = [...new Set(keys)]
  if (unique.length === 0) return result

  const bucket = getBucket()
  const s3 = getClient()
  for (let start = 0; start < unique.length; start += DELETE_BATCH_SIZE) {
    const batch = unique.slice(start, start + DELETE_BATCH_SIZE)
    try {
      const response = await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: false },
        })
      )
      const failedKeys = new Map<string, string>()
      for (const error of response.Errors ?? []) {
        if (!error.Key) continue
        // A key that does not exist is already deleted.
        if (error.Code === "NoSuchKey") continue
        failedKeys.set(error.Key, error.Code ?? "UNKNOWN")
      }
      for (const key of batch) {
        const code = failedKeys.get(key)
        if (code) result.failed.push({ key, code })
        else result.deleted.push(key)
      }
    } catch {
      for (const key of batch) result.failed.push({ key, code: "REQUEST_FAILED" })
    }
  }
  return result
}

export interface PresignOptions {
  expiresInSeconds?: number
  /** Filename suggested to the browser (downloads). */
  fileName?: string
  contentType?: string
}

/** Short-lived signed GET URL. Authorization is the caller's job; the URL itself is a bearer capability. */
export async function presignGet(key: string, options: PresignOptions = {}): Promise<string> {
  const safeName = options.fileName?.replace(/[^\w.\- ]/g, "_")
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
      ...(options.contentType ? { ResponseContentType: options.contentType } : {}),
      ...(safeName ? { ResponseContentDisposition: `inline; filename="${safeName}"` } : {}),
    }),
    { expiresIn: options.expiresInSeconds ?? DEFAULT_PRESIGN_SECONDS }
  )
}
