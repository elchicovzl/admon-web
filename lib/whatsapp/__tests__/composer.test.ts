import { describe, expect, it } from "vitest"
import {
  ComposerError,
  composerMode,
  evaluateResend,
  replyBlockedReason,
  resendAction,
  resendNeedsConfirmation,
  type ResendCandidate,
} from "../composer"

const NOW = new Date("2026-10-19T12:00:00.000Z")
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000)

describe("composerMode (WI-6, S-WI-3, S-WI-4)", () => {
  it("allows free text at 23:59 and reports the time left", () => {
    const state = composerMode({ status: "HUMAN", lastInboundAt: new Date(NOW.getTime() - (24 * 60 - 1) * 60_000), now: NOW })
    expect(state).toEqual({ mode: "FREE", remainingMs: 60_000 })
  })

  it("offers only templates at exactly 24:00 and after", () => {
    expect(composerMode({ status: "HUMAN", lastInboundAt: hoursAgo(24), now: NOW })).toEqual({ mode: "TEMPLATE_ONLY" })
    expect(composerMode({ status: "AI", lastInboundAt: hoursAgo(25), now: NOW })).toEqual({ mode: "TEMPLATE_ONLY" })
  })

  it("offers only templates when the customer never wrote", () => {
    expect(composerMode({ status: "HUMAN", lastInboundAt: null, now: NOW })).toEqual({ mode: "TEMPLATE_ONLY" })
  })

  it("locks a CLOSED conversation whatever the window says", () => {
    expect(composerMode({ status: "CLOSED", lastInboundAt: hoursAgo(1), now: NOW })).toEqual({
      mode: "LOCKED",
      reason: ComposerError.CLOSED_CONVERSATION,
    })
  })

  it("keeps AI and ESCALATED conversations replyable (the reply hands them to a person)", () => {
    for (const status of ["AI", "ESCALATED"] as const) {
      expect(composerMode({ status, lastInboundAt: hoursAgo(1), now: NOW }).mode).toBe("FREE")
    }
  })
})

describe("replyBlockedReason (WC-13)", () => {
  it("blocks free-form outside the window but lets templates through", () => {
    expect(replyBlockedReason({ status: "HUMAN", lastInboundAt: hoursAgo(30), now: NOW, template: false })).toBe(
      ComposerError.WINDOW_CLOSED
    )
    expect(replyBlockedReason({ status: "HUMAN", lastInboundAt: hoursAgo(30), now: NOW, template: true })).toBeNull()
  })

  it("blocks everything on a CLOSED conversation, templates included", () => {
    expect(replyBlockedReason({ status: "CLOSED", lastInboundAt: hoursAgo(1), now: NOW, template: true })).toBe(
      ComposerError.CLOSED_CONVERSATION
    )
  })

  it("allows free-form inside the window", () => {
    expect(replyBlockedReason({ status: "ESCALATED", lastInboundAt: hoursAgo(2), now: NOW, template: false })).toBeNull()
  })
})

describe("evaluateResend (S-WI-9, D6)", () => {
  const failed = (overrides: Partial<ResendCandidate> = {}): ResendCandidate => ({
    direction: "OUT",
    source: "DASHBOARD",
    status: "FAILED",
    type: "TEXT",
    errorCode: "131047",
    ...overrides,
  })
  const base = { conversationStatus: "HUMAN" as const, lastInboundAt: hoursAgo(1), now: NOW }

  it("accepts a FAILED dashboard text inside the window without confirmation", () => {
    expect(evaluateResend({ ...base, message: failed() })).toEqual({ ok: true, needsConfirmation: false, template: false })
  })

  it("asks for confirmation when the delivery is unconfirmed", () => {
    const decision = evaluateResend({ ...base, message: failed({ errorCode: "UNKNOWN_DELIVERY" }) })
    expect(decision).toEqual({ ok: true, needsConfirmation: true, template: false })
    expect(resendNeedsConfirmation("UNKNOWN_DELIVERY")).toBe(true)
    expect(resendNeedsConfirmation("WINDOW_CLOSED")).toBe(false)
    expect(resendNeedsConfirmation(null)).toBe(false)
  })

  it.each(["QUEUED", "SENT", "DELIVERED", "READ", "RECEIVED"] as const)("rejects a %s message", (status) => {
    expect(evaluateResend({ ...base, message: failed({ status }) }).ok).toBe(false)
  })

  it("rejects inbound messages", () => {
    expect(evaluateResend({ ...base, message: failed({ direction: "IN", source: "CLIENT" }) }).ok).toBe(false)
  })

  it.each(["AI", "SYSTEM", "PHONE_APP", "CLIENT"] as const)("rejects a %s message", (source) => {
    const decision = evaluateResend({ ...base, message: failed({ source }) })
    expect(decision).toEqual({ ok: false, message: "Solo se pueden reintentar mensajes enviados desde el panel." })
  })

  it("rejects types that were never sendable from the composer", () => {
    expect(evaluateResend({ ...base, message: failed({ type: "AUDIO" }) }).ok).toBe(false)
  })

  it("re-checks the window for free-form messages but not for templates", () => {
    const closed = { ...base, lastInboundAt: hoursAgo(30) }
    expect(evaluateResend({ ...closed, message: failed() })).toEqual({
      ok: false,
      message: "La ventana de 24 horas está cerrada. Envíe una plantilla aprobada.",
    })
    expect(evaluateResend({ ...closed, message: failed({ type: "IMAGE" }) }).ok).toBe(false)
    expect(evaluateResend({ ...closed, message: failed({ type: "TEMPLATE" }) })).toEqual({
      ok: true,
      needsConfirmation: false,
      template: true,
    })
  })

  it("rejects everything on a CLOSED conversation", () => {
    expect(evaluateResend({ ...base, conversationStatus: "CLOSED", message: failed({ type: "TEMPLATE" }) })).toEqual({
      ok: false,
      message: ComposerError.CLOSED_CONVERSATION,
    })
  })
})

describe("resendAction (what the FAILED bubble shows)", () => {
  const failed = (overrides: Partial<ResendCandidate> = {}): ResendCandidate => ({
    direction: "OUT",
    source: "DASHBOARD",
    status: "FAILED",
    type: "TEXT",
    errorCode: "131047",
    ...overrides,
  })
  const base = { conversationStatus: "HUMAN" as const, lastInboundAt: hoursAgo(1), now: NOW }

  it("shows an enabled button for a resendable message", () => {
    expect(resendAction({ ...base, message: failed() })).toEqual({ show: true, enabled: true, needsConfirmation: false })
  })

  it("flags an unconfirmed delivery so the UI asks first", () => {
    expect(resendAction({ ...base, message: failed({ errorCode: "UNKNOWN_DELIVERY" }) })).toMatchObject({
      enabled: true,
      needsConfirmation: true,
    })
  })

  it("shows nothing for AI, system, inbound or non-failed messages", () => {
    for (const message of [
      failed({ source: "AI" }),
      failed({ source: "SYSTEM" }),
      failed({ direction: "IN", source: "CLIENT" }),
      failed({ status: "SENT" }),
    ]) {
      expect(resendAction({ ...base, message })).toEqual({ show: false, enabled: false, needsConfirmation: false })
    }
  })

  it("shows a disabled button with the reason when the window is closed", () => {
    expect(resendAction({ ...base, lastInboundAt: hoursAgo(30), message: failed() })).toEqual({
      show: true,
      enabled: false,
      reason: "La ventana de 24 horas está cerrada. Envíe una plantilla aprobada.",
      needsConfirmation: false,
    })
  })
})
