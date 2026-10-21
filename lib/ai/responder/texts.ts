/**
 * Fixed texts the responder sends without the model (deterministic paths). Spanish, "usted".
 * Pure.
 */

export const HANDOFF_IN_HOURS_TEXT = "Un asesor lo atenderá en breve."

/** One neutral message when the AI cannot answer at all (S-AI-11): no blame, no technical words. */
export const AI_FAILURE_HOLDING_TEXT =
  "Disculpe, en este momento no puedo responderle. Un asesor revisará su mensaje y le responderá lo antes posible."

export const TRANSCRIPTION_FAILED_TEXT = "No pude escuchar su nota de voz. ¿Podría escribirme su consulta?"

export const UNSUPPORTED_MEDIA_TEXT =
  "Por ahora solo puedo leer mensajes de texto, notas de voz, imágenes y documentos PDF. ¿Podría escribirme su consulta?"

const slotParts = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
})

/** «lunes 26 de octubre a las 8:00» in Bogota time (Intl alone adds commas that read badly in a chat). */
export function formatBogotaSlot(at: Date): string {
  const p = Object.fromEntries(slotParts.formatToParts(at).map((part) => [part.type, part.value]))
  return `${p.weekday} ${p.day} de ${p.month} a las ${p.hour}:${p.minute}`
}

/** Handoff message: immediate inside business hours, with the next opening outside (S-AI-4/5). */
export function handoffText(hours: { isBusinessHours: boolean; nextBusinessSlot: Date | null }): string {
  if (hours.isBusinessHours || !hours.nextBusinessSlot) return HANDOFF_IN_HOURS_TEXT
  return (
    "Nuestro horario de atención es de lunes a viernes de 8:00 a. m. a 5:00 p. m. " +
    `Un asesor le responderá a partir del ${formatBogotaSlot(hours.nextBusinessSlot)}.`
  )
}
