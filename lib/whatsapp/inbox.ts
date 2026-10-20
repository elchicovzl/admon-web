import type { MessageStatus, MessageType } from '@prisma/client'
import type {
  ConversationMarker,
  ConversationSummary,
  ThreadMessage,
} from '@/lib/types/whatsapp.types'
import { isWindowOpen, windowRemainingMs } from './window'

/**
 * Pure inbox logic (WI-3, WI-4, WI-12): ordering, markers, labels and merge rules shared by the
 * server actions and the polling client. No I/O and no clock reads; "now" is always a parameter.
 */

const BOGOTA = 'America/Bogota'
export const PREVIEW_MAX = 90

// ---------------------------------------------------------------- ordering

function ms(iso: string | null): number {
  return iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY
}

/**
 * ESCALATED first, by `attentionDueAt` ascending (the one that must be attended first); a row
 * without a due date sorts after those that have one. Everything else follows by
 * `lastMessageAt` descending. Ties break on id so the order is stable across polls.
 */
export function compareConversations(a: ConversationSummary, b: ConversationSummary): number {
  const aEsc = a.status === 'ESCALATED'
  const bEsc = b.status === 'ESCALATED'
  if (aEsc !== bEsc) return aEsc ? -1 : 1
  if (aEsc && bEsc) {
    const byDue = ms(a.attentionDueAt) - ms(b.attentionDueAt)
    if (byDue !== 0 && !Number.isNaN(byDue)) return byDue
  }
  const byLast = ms(b.lastMessageAt) - ms(a.lastMessageAt)
  if (byLast !== 0) return byLast
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function sortConversations(items: ConversationSummary[]): ConversationSummary[] {
  return [...items].sort(compareConversations)
}

/** Replaces rows by id (a stale copy never overwrites a newer one) and re-sorts. */
export function mergeConversations(
  current: ConversationSummary[],
  incoming: ConversationSummary[]
): ConversationSummary[] {
  const byId = new Map(current.map((item) => [item.id, item]))
  for (const item of incoming) {
    const existing = byId.get(item.id)
    if (!existing || ms(item.updatedAt) >= ms(existing.updatedAt)) byId.set(item.id, item)
  }
  return sortConversations([...byId.values()])
}

/** Oldest first; same-id rows are replaced (status ticks), new ids are appended in order. */
export function mergeMessages(current: ThreadMessage[], incoming: ThreadMessage[]): ThreadMessage[] {
  const byId = new Map(current.map((item) => [item.id, item]))
  for (const item of incoming) {
    const existing = byId.get(item.id)
    if (!existing || ms(item.updatedAt) >= ms(existing.updatedAt)) byId.set(item.id, item)
  }
  return [...byId.values()].sort((a, b) => {
    const diff = ms(a.timestamp) - ms(b.timestamp)
    if (diff !== 0) return diff
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

/** True when `incoming` carries a customer message the current thread has not shown yet. */
export function hasNewInbound(current: ThreadMessage[], incoming: ThreadMessage[]): boolean {
  const known = new Set(current.map((message) => message.id))
  return incoming.some((message) => message.direction === 'IN' && !known.has(message.id))
}

// ---------------------------------------------------------------- markers and labels

export function conversationMarkers(input: {
  hasClient: boolean
  matchStatus: 'MATCHED' | 'UNMATCHED' | 'AMBIGUOUS' | 'MANUAL'
  leadStatus: 'NEW' | 'CONTACTED' | 'CONVERTED' | 'DISCARDED' | null
}): ConversationMarker[] {
  if (input.matchStatus === 'AMBIGUOUS') return ['AMBIGUOUS']
  if (input.hasClient) return []
  const markers: ConversationMarker[] = ['NO_CLIENT']
  if (input.leadStatus === 'NEW' || input.leadStatus === 'CONTACTED') markers.push('LEAD')
  return markers
}

export const MARKER_LABEL: Record<ConversationMarker, string> = {
  NO_CLIENT: 'Sin cliente',
  LEAD: 'Lead',
  AMBIGUOUS: 'Ambiguo',
}

/** Client name, else the WhatsApp profile name, else the phone (WI-3). */
export function resolveDisplayName(input: {
  clientName: string | null
  profileName: string | null
  waId: string
}): string {
  return input.clientName?.trim() || input.profileName?.trim() || `+${input.waId}`
}

/** "lun 8:00": weekday and 24 h time in Bogota, whatever the server or browser zone. */
export function formatAttentionSlot(date: Date): string {
  const parts = new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA,
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  const weekday = get('weekday').replace('.', '')
  return `${weekday} ${get('hour')}:${get('minute')}`
}

/**
 * "Atender: lun 8:00" for an ESCALATED conversation that came in out of hours and whose
 * attention slot is still ahead (WI-12). Null otherwise.
 */
export function attentionLabel(
  item: Pick<ConversationSummary, 'status' | 'escalatedOutOfHours' | 'attentionDueAt'>,
  now: Date
): string | null {
  if (item.status !== 'ESCALATED' || !item.escalatedOutOfHours || !item.attentionDueAt) return null
  const due = new Date(item.attentionDueAt)
  if (due.getTime() <= now.getTime()) return null
  return `Atender: ${formatAttentionSlot(due)}`
}

export const STATUS_LABEL: Record<ConversationSummary['status'], string> = {
  AI: 'IA',
  HUMAN: 'Asesor',
  ESCALATED: 'Escalada',
  CLOSED: 'Cerrada',
}

// ---------------------------------------------------------------- previews and bubbles

const TYPE_LABEL: Record<MessageType, string> = {
  TEXT: 'Mensaje',
  IMAGE: 'Imagen',
  AUDIO: 'Nota de voz',
  DOCUMENT: 'Documento',
  VIDEO: 'Video',
  STICKER: 'Sticker',
  LOCATION: 'Ubicación',
  CONTACTS: 'Contacto',
  INTERACTIVE: 'Mensaje interactivo',
  REACTION: 'Reacción',
  TEMPLATE: 'Plantilla',
  UNSUPPORTED: 'Mensaje no compatible',
}

/** Text to show when a bubble has no body of its own. */
export function messageTypeLabel(type: MessageType): string {
  return TYPE_LABEL[type]
}

/** One line for the list: whitespace collapsed, capped, never empty. */
export function listPreview(preview: string | null, max = PREVIEW_MAX): string {
  const text = preview?.replace(/\s+/g, ' ').trim()
  if (!text) return 'Sin mensajes'
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export function senderLabel(message: Pick<ThreadMessage, 'source' | 'senderName'>): string {
  switch (message.source) {
    case 'CLIENT':
      return 'Cliente'
    case 'AI':
      return 'IA'
    case 'DASHBOARD':
      return message.senderName ? `Asesor (${message.senderName})` : 'Asesor'
    case 'PHONE_APP':
      return 'Teléfono'
    case 'SYSTEM':
      return 'Sistema'
  }
}

const DELIVERY_LABEL: Record<MessageStatus, string> = {
  RECEIVED: 'Recibido',
  QUEUED: 'Enviando',
  SENT: 'Enviado',
  DELIVERED: 'Entregado',
  READ: 'Leído',
  FAILED: 'Falló',
}

export function deliveryLabel(status: MessageStatus): string {
  return DELIVERY_LABEL[status]
}

export type MediaKind = 'image' | 'audio' | 'document' | 'other'

/** How the viewer renders an attachment: preview, player, link or placeholder. */
export function mediaKind(type: MessageType, mimeType: string): MediaKind {
  if (type === 'IMAGE' || (type === 'STICKER' && mimeType.startsWith('image/'))) return 'image'
  if (type === 'AUDIO') return 'audio'
  if (type === 'DOCUMENT') return 'document'
  return 'other'
}

// ---------------------------------------------------------------- 24 h window

export interface WindowState {
  open: boolean
  remainingMs: number
  label: string
}

export function formatRemaining(remainingMs: number): string {
  const totalMinutes = Math.max(0, Math.floor(remainingMs / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`
}

export function windowState(now: Date, lastInboundAt: string | Date | null): WindowState {
  const last = lastInboundAt ? new Date(lastInboundAt) : null
  if (!isWindowOpen(now, last)) {
    return { open: false, remainingMs: 0, label: 'Ventana cerrada · solo plantillas' }
  }
  const remainingMs = windowRemainingMs(now, last)
  return { open: true, remainingMs, label: `Ventana abierta · quedan ${formatRemaining(remainingMs)}` }
}

// ---------------------------------------------------------------- times

function bogotaDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BOGOTA }).format(date)
}

/** Bubble time "14:05" in Bogota. */
export function formatClock(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

/** List time: the clock for today, "dd/MM" otherwise (Bogota days). */
export function formatListTime(iso: string, now: Date): string {
  const date = new Date(iso)
  if (bogotaDay(date) === bogotaDay(now)) return formatClock(iso)
  return new Intl.DateTimeFormat('es-CO', { timeZone: BOGOTA, day: '2-digit', month: '2-digit' }).format(date)
}

// ---------------------------------------------------------------- deep link

/** `?c=` comes from the URL, so it is validated before it reaches an action. */
export function parseConversationParam(value: string | string[] | null | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  return raw && /^c[a-z0-9]{20,30}$/.test(raw) ? raw : null
}
