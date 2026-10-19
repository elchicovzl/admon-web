/**
 * 24 h customer-service window (WC-13, WI-8). Meta only allows free-form messages within
 * 24 h of the customer's last inbound message; outside it only approved templates go out.
 * Pure functions: the clock is always passed in.
 */
export const WINDOW_MS = 24 * 60 * 60 * 1000

/** Open strictly before the 24 h mark: 23:59 is open, 24:00:00 exactly is closed. No inbound yet means closed. */
export function isWindowOpen(now: Date, lastInboundAt: Date | null): boolean {
  if (!lastInboundAt) return false
  return now.getTime() - lastInboundAt.getTime() < WINDOW_MS
}

/** Milliseconds until the window closes; 0 when closed or when the customer never wrote. */
export function windowRemainingMs(now: Date, lastInboundAt: Date | null): number {
  if (!lastInboundAt) return 0
  return Math.max(0, WINDOW_MS - (now.getTime() - lastInboundAt.getTime()))
}
