import type { ConversationStatus, MessageDirection, MessageSource, MessageStatus, MessageType } from "@prisma/client"
import { SendErrorCode } from "./send-errors"
import { isWindowOpen, windowRemainingMs } from "./window"

/**
 * Pure reply rules shared by the composer UI and the server actions (WI-6, WI-7, WC-13, D6):
 * what may be sent now, and whether a FAILED message may be sent again. The server calls the
 * same functions, so the UI can never offer something the server would accept differently.
 * No I/O; the clock is always a parameter.
 */

export const REPLY_TEXT_MAX_LENGTH = 4096

export const ComposerError = {
  CLOSED_CONVERSATION: "La conversación está cerrada. Reábrala antes de responder.",
  WINDOW_CLOSED: "La ventana de 24 horas está cerrada. Solo puede enviar plantillas aprobadas.",
  CHANNEL_DISABLED: "El canal de WhatsApp está desactivado. No se pueden enviar mensajes.",
  QUEUE_FAILED: "No se pudo encolar el mensaje. Quedó marcado como fallido y puede reintentarlo.",
} as const

export type ComposerMode =
  /** Free text, attachments and templates are allowed. */
  | { mode: "FREE"; remainingMs: number }
  /** The 24 h window is closed: only approved templates. */
  | { mode: "TEMPLATE_ONLY" }
  /** Nothing can be sent until the conversation is reopened. */
  | { mode: "LOCKED"; reason: string }

export function composerMode(input: {
  status: ConversationStatus
  lastInboundAt: Date | null
  now: Date
}): ComposerMode {
  if (input.status === "CLOSED") return { mode: "LOCKED", reason: ComposerError.CLOSED_CONVERSATION }
  if (!isWindowOpen(input.now, input.lastInboundAt)) return { mode: "TEMPLATE_ONLY" }
  return { mode: "FREE", remainingMs: windowRemainingMs(input.now, input.lastInboundAt) }
}

/** Server guard for a reply: null when it may go out, otherwise the Spanish reason. */
export function replyBlockedReason(input: {
  status: ConversationStatus
  lastInboundAt: Date | null
  now: Date
  /** Templates are allowed outside the 24 h window; everything else needs it open (WC-13). */
  template: boolean
}): string | null {
  if (input.status === "CLOSED") return ComposerError.CLOSED_CONVERSATION
  if (!input.template && !isWindowOpen(input.now, input.lastInboundAt)) return ComposerError.WINDOW_CLOSED
  return null
}

// ---------------------------------------------------------------- resend (S-WI-9, D6)

export interface ResendCandidate {
  direction: MessageDirection
  source: MessageSource
  status: MessageStatus
  type: MessageType
  errorCode: string | null
}

export type ResendDecision =
  | {
      ok: true
      /** True when the message may already have been delivered (UNKNOWN_DELIVERY): ask the user first. */
      needsConfirmation: boolean
      template: boolean
    }
  | { ok: false; message: string }

const RESENDABLE_TYPES: readonly MessageType[] = ["TEXT", "TEMPLATE", "IMAGE", "DOCUMENT"]

/** True when the UI must ask "may already have been delivered, send again?" before resending. */
export function resendNeedsConfirmation(errorCode: string | null): boolean {
  return errorCode === SendErrorCode.UNKNOWN_DELIVERY
}

/**
 * Only FAILED outbound messages written from the dashboard can be sent again. AI and system
 * messages are not manually resendable: the next AI turn (or an escalation) owns them. A
 * free-form message needs the window open again; a template does not.
 */
export function evaluateResend(input: {
  message: ResendCandidate
  conversationStatus: ConversationStatus
  lastInboundAt: Date | null
  now: Date
}): ResendDecision {
  const { message } = input
  if (message.direction !== "OUT" || message.status !== "FAILED") {
    return { ok: false, message: "Solo se pueden reintentar mensajes fallidos." }
  }
  if (message.source !== "DASHBOARD") {
    return { ok: false, message: "Solo se pueden reintentar mensajes enviados desde el panel." }
  }
  if (!RESENDABLE_TYPES.includes(message.type)) {
    return { ok: false, message: "Este tipo de mensaje no se puede reintentar." }
  }
  const template = message.type === "TEMPLATE"
  const blocked = replyBlockedReason({
    status: input.conversationStatus,
    lastInboundAt: input.lastInboundAt,
    now: input.now,
    template,
  })
  if (blocked) {
    return {
      ok: false,
      message: blocked === ComposerError.WINDOW_CLOSED ? "La ventana de 24 horas está cerrada. Envíe una plantilla aprobada." : blocked,
    }
  }
  return { ok: true, needsConfirmation: resendNeedsConfirmation(message.errorCode), template }
}

export interface ResendAction {
  /** False for messages that never get a retry button (not failed, not from the dashboard). */
  show: boolean
  enabled: boolean
  /** Why the button is disabled (window closed, conversation closed...). */
  reason?: string
  needsConfirmation: boolean
}

const HIDDEN: ResendAction = { show: false, enabled: false, needsConfirmation: false }

/** What the FAILED bubble offers: a retry button, a disabled one with the reason, or nothing. */
export function resendAction(input: {
  message: ResendCandidate
  conversationStatus: ConversationStatus
  lastInboundAt: Date | null
  now: Date
}): ResendAction {
  const { message } = input
  if (message.direction !== "OUT" || message.status !== "FAILED" || message.source !== "DASHBOARD") return HIDDEN
  const decision = evaluateResend(input)
  if (decision.ok) return { show: true, enabled: true, needsConfirmation: decision.needsConfirmation }
  return { show: true, enabled: false, reason: decision.message, needsConfirmation: false }
}
