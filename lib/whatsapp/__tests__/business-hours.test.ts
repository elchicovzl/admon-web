import { afterEach, describe, expect, it, vi } from "vitest"
import { BUSINESS_HOURS, isBusinessHours, nextBusinessSlot } from "../business-hours"

// Bogota is UTC-5 all year (no daylight saving time): 08:00 local = 13:00Z, 17:00 local = 22:00Z.
const at = (iso: string) => new Date(iso)

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("isBusinessHours (AI-10, S-AI-6)", () => {
  it("is Monday to Friday, 08:00:00 inclusive to 17:00:00 exclusive, America/Bogota", () => {
    expect(BUSINESS_HOURS).toEqual({ timeZone: "America/Bogota", startHour: 8, endHour: 17 })
    // Friday 2026-10-23
    expect(isBusinessHours(at("2026-10-23T13:00:00Z"))).toBe(true) // 08:00:00
    expect(isBusinessHours(at("2026-10-23T12:59:59Z"))).toBe(false) // 07:59:59
    expect(isBusinessHours(at("2026-10-23T21:59:59Z"))).toBe(true) // 16:59:59
    expect(isBusinessHours(at("2026-10-23T22:00:00Z"))).toBe(false) // 17:00:00
  })

  it("is closed on weekends", () => {
    expect(isBusinessHours(at("2026-10-24T15:00:00Z"))).toBe(false) // Saturday 10:00
    expect(isBusinessHours(at("2026-10-25T15:00:00Z"))).toBe(false) // Sunday 10:00
  })

  it("uses the Bogota calendar day, not the UTC one", () => {
    // Saturday 2026-10-24 02:00Z is still Friday 21:00 in Bogota: closed by the hour, not the day.
    expect(isBusinessHours(at("2026-10-24T02:00:00Z"))).toBe(false)
    // Monday 2026-10-26 13:30Z is Monday 08:30 in Bogota.
    expect(isBusinessHours(at("2026-10-26T13:30:00Z"))).toBe(true)
  })

  it("does not depend on the host time zone", () => {
    vi.stubEnv("TZ", "Asia/Tokyo")
    expect(isBusinessHours(at("2026-10-23T13:00:00Z"))).toBe(true)
  })

  it("ignores holidays unless a holiday list is given (OI-1)", () => {
    const holiday = at("2026-10-12T15:00:00Z") // Monday, Día de la Raza in Colombia
    expect(isBusinessHours(holiday)).toBe(true)
    expect(isBusinessHours(holiday, { holidays: new Set(["2026-10-12"]) })).toBe(false)
  })
})

describe("nextBusinessSlot", () => {
  it("returns the same moment inside business hours", () => {
    const now = at("2026-10-23T15:00:00Z")
    expect(nextBusinessSlot(now)).toEqual(now)
  })

  it("returns 08:00 the same day before opening", () => {
    expect(nextBusinessSlot(at("2026-10-23T11:00:00Z"))).toEqual(at("2026-10-23T13:00:00Z"))
  })

  it("returns Monday 08:00 from Friday evening and from the weekend", () => {
    expect(nextBusinessSlot(at("2026-10-23T22:00:00Z"))).toEqual(at("2026-10-26T13:00:00Z"))
    expect(nextBusinessSlot(at("2026-10-24T18:00:00Z"))).toEqual(at("2026-10-26T13:00:00Z"))
    expect(nextBusinessSlot(at("2026-10-24T02:00:00Z"))).toEqual(at("2026-10-26T13:00:00Z"))
  })

  it("skips listed holidays", () => {
    // Friday 2026-10-09 after closing; Monday 2026-10-12 is a holiday -> Tuesday 08:00.
    expect(nextBusinessSlot(at("2026-10-09T23:00:00Z"), { holidays: new Set(["2026-10-12"]) })).toEqual(
      at("2026-10-13T13:00:00Z")
    )
  })
})
