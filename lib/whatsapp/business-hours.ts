/**
 * Business hours (AI-10, S-AI-6): Monday to Friday, 08:00:00 inclusive to 17:00:00 exclusive,
 * America/Bogota. Colombia has no daylight saving time, so Bogota is UTC-5 all year: the local
 * calendar is read with Intl (independent of the host time zone) and slots are built with the
 * fixed offset. Holidays count only when a list is passed (OI-1: no holiday calendar ships).
 */

export const BUSINESS_HOURS = { timeZone: "America/Bogota", startHour: 8, endHour: 17 } as const

const BOGOTA_OFFSET_HOURS = -5
const DAY_MS = 24 * 60 * 60 * 1000

export interface BusinessHoursOptions {
  /** Local dates (`YYYY-MM-DD`) treated as closed. */
  holidays?: ReadonlySet<string>
}

const localParts = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_HOURS.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  hourCycle: "h23",
})

function local(at: Date): { date: string; weekday: string; hour: number } {
  const parts = Object.fromEntries(localParts.formatToParts(at).map((part) => [part.type, part.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: parts.weekday, hour: Number(parts.hour) }
}

function isWorkday(date: string, weekday: string, options: BusinessHoursOptions): boolean {
  return weekday !== "Sat" && weekday !== "Sun" && !options.holidays?.has(date)
}

export function isBusinessHours(at: Date, options: BusinessHoursOptions = {}): boolean {
  const { date, weekday, hour } = local(at)
  return isWorkday(date, weekday, options) && hour >= BUSINESS_HOURS.startHour && hour < BUSINESS_HOURS.endHour
}

/** UTC instant of `startHour` on a Bogota local date. */
function opening(date: string): Date {
  return new Date(`${date}T${String(BUSINESS_HOURS.startHour - BOGOTA_OFFSET_HOURS).padStart(2, "0")}:00:00Z`)
}

/** `at` itself during business hours, otherwise the next opening (08:00 Bogota on a workday). */
export function nextBusinessSlot(at: Date, options: BusinessHoursOptions = {}): Date {
  if (isBusinessHours(at, options)) return at
  const today = local(at)
  if (isWorkday(today.date, today.weekday, options) && today.hour < BUSINESS_HOURS.startHour) return opening(today.date)
  // Walk forward day by day (at most a long weekend plus holidays).
  for (let days = 1; days <= 14; days++) {
    const candidate = local(new Date(opening(today.date).getTime() + days * DAY_MS))
    if (isWorkday(candidate.date, candidate.weekday, options)) return opening(candidate.date)
  }
  throw new Error("No business day within two weeks")
}
