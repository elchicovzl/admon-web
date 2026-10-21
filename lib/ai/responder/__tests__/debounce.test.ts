import { describe, expect, it } from "vitest"
import { decideDebounce } from "../debounce"

const T0 = new Date("2026-10-20T15:00:00Z")
const later = (seconds: number) => new Date(T0.getTime() + seconds * 1000)
const cfg = { debounceSeconds: 8, debounceMaxSeconds: 30 }

describe("decideDebounce (AI-7, S-AI-7)", () => {
  it("waits until the client has been quiet for 8 seconds", () => {
    expect(decideDebounce({ now: later(3), lastInboundAt: later(0), oldestPendingAt: T0, mediaPending: false }, cfg)).toEqual({
      action: "WAIT",
      delaySeconds: 5,
    })
  })

  it("answers once the client has been quiet for 8 seconds", () => {
    expect(decideDebounce({ now: later(8), lastInboundAt: later(0), oldestPendingAt: T0, mediaPending: false }, cfg)).toEqual({
      action: "RUN",
      unreadyMediaFailed: false,
    })
  })

  it("never waits past 30 seconds from the first pending message, even if the client keeps typing", () => {
    expect(decideDebounce({ now: later(27), lastInboundAt: later(26), oldestPendingAt: T0, mediaPending: false }, cfg)).toEqual({
      action: "WAIT",
      delaySeconds: 3,
    })
    expect(decideDebounce({ now: later(30), lastInboundAt: later(29), oldestPendingAt: T0, mediaPending: false }, cfg)).toEqual({
      action: "RUN",
      unreadyMediaFailed: false,
    })
  })

  it("waits for media still downloading or transcribing", () => {
    expect(decideDebounce({ now: later(12), lastInboundAt: later(0), oldestPendingAt: T0, mediaPending: true }, cfg)).toEqual({
      action: "WAIT",
      delaySeconds: 8,
    })
  })

  it("after the maximum, answers anyway and treats media that is not ready as failed", () => {
    expect(decideDebounce({ now: later(31), lastInboundAt: later(0), oldestPendingAt: T0, mediaPending: true }, cfg)).toEqual({
      action: "RUN",
      unreadyMediaFailed: true,
    })
  })

  it("caps a media wait at the time left before the maximum", () => {
    expect(decideDebounce({ now: later(25), lastInboundAt: later(0), oldestPendingAt: T0, mediaPending: true }, cfg)).toEqual({
      action: "WAIT",
      delaySeconds: 5,
    })
  })
})
