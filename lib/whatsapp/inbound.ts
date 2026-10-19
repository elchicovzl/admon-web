import { Prisma, type Conversation, type MessageType, type WhatsAppContact } from "@prisma/client"
import prisma from "@/lib/db/prisma"
import { getBoss } from "@/lib/queue/boss"
import { QUEUES } from "@/lib/queue/queues"
import { ensureLead, upsertAndMatchContact } from "./contacts"

type Json = Record<string, unknown>

export interface ParsedInboundMessage {
  wamid: string
  from: string
  timestamp: Date
  type: MessageType
  text: string | null
  contextWamid: string | null
  media: { metaMediaId: string; mimeType: string; sha256: string | null; fileName: string | null } | null
}

const PREVIEW_MAX = 80

/** Placeholders shown in the inbox list for messages with no text (UI copy, Spanish). */
const PREVIEW_PLACEHOLDER: Partial<Record<MessageType, string>> = {
  IMAGE: "[Imagen]",
  AUDIO: "[Audio]",
  DOCUMENT: "[Documento]",
  VIDEO: "[Video]",
  STICKER: "[Sticker]",
  LOCATION: "[Ubicación]",
  CONTACTS: "[Contacto]",
  REACTION: "[Reacción]",
  INTERACTIVE: "[Respuesta]",
  UNSUPPORTED: "[Mensaje no compatible]",
}

/** Types Meta delivers as downloadable media: a WhatsAppMedia row is created for each. */
const MEDIA_TYPES = new Set(["image", "audio", "document", "video", "sticker"])

const KNOWN_TYPES: Record<string, MessageType> = {
  text: "TEXT",
  image: "IMAGE",
  audio: "AUDIO",
  document: "DOCUMENT",
  video: "VIDEO",
  sticker: "STICKER",
  location: "LOCATION",
  contacts: "CONTACTS",
  interactive: "INTERACTIVE",
  reaction: "REACTION",
}

function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function parseTimestamp(value: unknown, fallback: Date): Date {
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : fallback
}

/**
 * Turns Meta's message object into our shape. Pure. Unknown types become UNSUPPORTED so
 * a new Meta message type is stored with a placeholder instead of crashing (WC-6, S-WC-13).
 * Returns null only when the item has no id or sender, which cannot be stored.
 */
export function parseInboundMessage(item: unknown, receivedAt: Date = new Date()): ParsedInboundMessage | null {
  const raw = asRecord(item)
  const wamid = asString(raw?.id)
  const from = asString(raw?.from)
  if (!raw || !wamid || !from) return null

  const metaType = asString(raw.type) ?? "unsupported"
  const type = KNOWN_TYPES[metaType] ?? "UNSUPPORTED"
  const body = asRecord(raw[metaType])

  let text: string | null = null
  if (type === "TEXT") text = asString(body?.body)
  else if (type === "REACTION") text = asString(body?.emoji)
  else if (type === "INTERACTIVE") {
    text = asString(asRecord(body?.button_reply)?.title) ?? asString(asRecord(body?.list_reply)?.title)
  } else if (MEDIA_TYPES.has(metaType)) text = asString(body?.caption)

  const metaMediaId = MEDIA_TYPES.has(metaType) ? asString(body?.id) : null
  const media = metaMediaId
    ? {
        metaMediaId,
        mimeType: asString(body?.mime_type) ?? "application/octet-stream",
        sha256: asString(body?.sha256),
        fileName: asString(body?.filename),
      }
    : null

  return {
    wamid,
    from,
    timestamp: parseTimestamp(raw.timestamp, receivedAt),
    type,
    text,
    contextWamid: asString(asRecord(raw.context)?.id) ?? asString(body?.message_id),
    media,
  }
}

export function messagePreview(message: Pick<ParsedInboundMessage, "type" | "text">): string {
  const text = message.text?.replace(/\s+/g, " ").trim()
  if (text) return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX - 1)}…` : text
  return PREVIEW_PLACEHOLDER[message.type] ?? ""
}

function profileNameFor(contacts: unknown, from: string): string | null {
  if (!Array.isArray(contacts)) return null
  for (const entry of contacts) {
    const contact = asRecord(entry)
    if (contact && asString(contact.wa_id) === from) return asString(asRecord(contact.profile)?.name)
  }
  return null
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

/**
 * AI-eligibility for a brand-new or reopened conversation: the env kill switch and the
 * DB switch must both be on. Per-conversation pause and the full state machine arrive in
 * PR2.1; this is the minimal rule the first-contact and reopen transitions need (CH-1, CH-2).
 */
async function initialStatus(): Promise<"AI" | "HUMAN"> {
  if (process.env.WHATSAPP_AI_ENABLED?.trim() !== "true") return "HUMAN"
  const settings = await prisma.whatsAppSettings.findUnique({
    where: { id: "singleton" },
    select: { aiEnabled: true },
  })
  return settings?.aiEnabled ? "AI" : "HUMAN"
}

/** One conversation per contact. A concurrent first contact that loses the race re-reads (D4.6). */
async function getOrCreateConversation(contact: WhatsAppContact, firstMessageAt: Date): Promise<Conversation> {
  const existing = await prisma.conversation.findUnique({ where: { contactId: contact.id } })
  if (existing) return existing

  const status = await initialStatus()
  try {
    return await prisma.conversation.create({
      data: {
        contactId: contact.id,
        status,
        lastMessageAt: firstMessageAt,
        events: {
          create: { fromStatus: null, toStatus: status, event: "INBOUND_FIRST_CONTACT", actor: "CLIENT" },
        },
      },
    })
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    const winner = await prisma.conversation.findUnique({ where: { contactId: contact.id } })
    if (!winner) throw error
    return winner
  }
}

/** Queues the media download. Throws on failure so the event retries; singletonKey makes a retry safe. */
async function enqueueMediaDownload(messageId: string): Promise<void> {
  const boss = await getBoss()
  await boss.send(QUEUES.MEDIA_DOWNLOAD, { messageId }, { singletonKey: messageId })
}

/**
 * Persists one inbound message and everything that hangs off it (WC-6, CH-1, CH-11):
 * contact upsert and Client match, the contact's single conversation (created, or reopened
 * if CLOSED), the message with its media row, and the conversation counters. A wamid that is
 * already stored is skipped (WC-4) but its follow-up steps still run, so a retry after a
 * partial failure completes the work instead of losing it. Lead creation comes last and
 * never blocks message persistence (LD-2).
 */
export async function processInboundMessage(payload: unknown, receivedAt: Date = new Date()): Promise<void> {
  const context = asRecord(payload)
  const message = parseInboundMessage(context?.item, receivedAt)
  if (!message) {
    console.warn("[whatsapp] inbound item has no id or sender; skipped")
    return
  }

  const contact = await upsertAndMatchContact({
    waId: message.from,
    profileName: profileNameFor(context?.contacts, message.from),
    seenAt: message.timestamp,
  })
  const conversation = await getOrCreateConversation(contact, message.timestamp)

  let stored = await findStoredMessage(message.wamid)
  if (!stored) {
    try {
      stored = await persistMessage(conversation, message)
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      stored = await findStoredMessage(message.wamid) // concurrent duplicate delivery (WC-4)
      if (!stored) throw error
    }
  }

  if (stored.media?.status === "PENDING") await enqueueMediaDownload(stored.id)

  if (contact.matchStatus === "UNMATCHED") {
    try {
      await ensureLead(contact, conversation.id)
    } catch {
      console.error("[whatsapp] lead creation failed; message was stored")
    }
  }
}

function findStoredMessage(wamid: string) {
  return prisma.whatsAppMessage.findUnique({
    where: { wamid },
    select: { id: true, media: { select: { status: true } } },
  })
}

async function persistMessage(conversation: Conversation, message: ParsedInboundMessage) {
  const ts = message.timestamp
  return prisma.$transaction(async (tx) => {
    if (conversation.status === "CLOSED") {
      // Auto-reopen on inbound (CH-2, CH-11). The guard makes a concurrent reopen a no-op.
      const to = await initialStatus()
      const reopened = await tx.conversation.updateMany({
        where: { id: conversation.id, status: "CLOSED" },
        data: { status: to, stateVersion: { increment: 1 }, closedAt: null, closedById: null },
      })
      if (reopened.count > 0) {
        await tx.conversationEvent.create({
          data: {
            conversationId: conversation.id,
            fromStatus: "CLOSED",
            toStatus: to,
            event: "INBOUND_REOPEN",
            actor: "CLIENT",
          },
        })
      }
    }

    const created = await tx.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        wamid: message.wamid,
        direction: "IN",
        source: "CLIENT",
        type: message.type,
        text: message.text,
        status: "RECEIVED",
        statusRank: 0,
        contextWamid: message.contextWamid,
        timestamp: ts,
        ...(message.media
          ? {
              media: {
                create: {
                  metaMediaId: message.media.metaMediaId,
                  mimeType: message.media.mimeType,
                  sha256: message.media.sha256,
                  fileName: message.media.fileName,
                  status: "PENDING",
                },
              },
            }
          : {}),
      },
      select: { id: true, media: { select: { status: true } } },
    })

    // Counters. Timestamps only move forward so a late-processed older message cannot
    // shrink the 24 h window (lastInboundAt) or replace a newer preview.
    await tx.conversation.update({ where: { id: conversation.id }, data: { unreadCount: { increment: 1 } } })
    await tx.conversation.updateMany({
      where: { id: conversation.id, OR: [{ lastInboundAt: null }, { lastInboundAt: { lt: ts } }] },
      data: { lastInboundAt: ts },
    })
    await tx.conversation.updateMany({
      where: { id: conversation.id, lastMessageAt: { lte: ts } },
      data: { lastMessageAt: ts, lastMessagePreview: messagePreview(message) },
    })

    return created
  })
}
