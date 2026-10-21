/**
 * First-contact notice (AI-5, S-AI-2): the client is told they are talking to an AI and that
 * continuing means accepting the privacy policy. Every message the assistant sends before the
 * notice was delivered carries it as a prefix, holding and handoff texts included; the turn
 * (PR3.6b) records `consentNoticeSentAt` only once a carrier message reaches SENT. Pure.
 */

const DEFAULT_SITE_URL = "https://administracionsegura.co"

/** `NEXT_PUBLIC_SITE_URL` without a trailing slash, with the same default as lib/seo.ts. */
export function siteUrlFrom(env: Partial<Record<string, string | undefined>> = process.env): string {
  return (env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, "")
}

export function consentNotice(siteUrl: string): string {
  return (
    "Hola, le escribe el asistente virtual de Administración Segura, un sistema de inteligencia artificial. " +
    `Al continuar esta conversación, acepta nuestra política de tratamiento de datos: ${siteUrl}/privacy. ` +
    "Si en cualquier momento prefiere hablar con una persona, escriba «asesor»."
  )
}

export function prefixConsent(text: string, consentNoticeSentAt: Date | null, siteUrl: string): string {
  return consentNoticeSentAt ? text : `${consentNotice(siteUrl)}\n\n${text}`
}
