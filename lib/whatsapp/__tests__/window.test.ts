import { describe, expect, it } from "vitest"
import { WINDOW_MS, isWindowOpen, windowRemainingMs } from "../window"

const NOW = new Date("2026-10-19T12:00:00Z")
const ago = (ms: number) => new Date(NOW.getTime() - ms)
const MINUTE = 60_000
const HOUR = 60 * MINUTE

describe("isWindowOpen (WC-13, WI-8)", () => {
  it("is open at 23h59m (S-WI-4)", () => {
    expect(isWindowOpen(NOW, ago(23 * HOUR + 59 * MINUTE))).toBe(true)
  })

  it("is closed at exactly 24h (S-WI-3)", () => {
    expect(isWindowOpen(NOW, ago(WINDOW_MS))).toBe(false)
  })

  it("is closed at 25h", () => {
    expect(isWindowOpen(NOW, ago(25 * HOUR))).toBe(false)
  })

  it("is closed when the customer never wrote", () => {
    expect(isWindowOpen(NOW, null)).toBe(false)
  })
})

describe("windowRemainingMs", () => {
  it("counts down to the 24h mark", () => {
    expect(windowRemainingMs(NOW, ago(5 * HOUR))).toBe(19 * HOUR)
  })

  it("is 0 once closed and when there is no inbound", () => {
    expect(windowRemainingMs(NOW, ago(WINDOW_MS))).toBe(0)
    expect(windowRemainingMs(NOW, ago(30 * HOUR))).toBe(0)
    expect(windowRemainingMs(NOW, null)).toBe(0)
  })
})
