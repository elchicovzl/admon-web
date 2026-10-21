/**
 * Debounce for AI turns (AI-7, S-AI-7). People send bursts ("hola" … "una pregunta" … audio), so
 * the assistant answers once the client has been quiet for `debounceSeconds` (8), waits for
 * attachments still downloading or transcribing, and never holds a reply more than
 * `debounceMaxSeconds` (30) after the first pending message. Past that limit it answers with what
 * it has and treats attachments that are still not ready as failed. Pure.
 */

export interface DebounceInput {
  now: Date
  /** Latest inbound message of the burst. */
  lastInboundAt: Date
  /** First inbound message not answered yet. */
  oldestPendingAt: Date
  /** An attachment of the burst is still downloading or being transcribed. */
  mediaPending: boolean
}

export interface DebounceConfig {
  debounceSeconds: number
  debounceMaxSeconds: number
}

export type DebounceDecision = { action: "WAIT"; delaySeconds: number } | { action: "RUN"; unreadyMediaFailed: boolean }

const seconds = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 1000

export function decideDebounce(input: DebounceInput, config: DebounceConfig): DebounceDecision {
  const leftBeforeMax = config.debounceMaxSeconds - seconds(input.oldestPendingAt, input.now)
  if (leftBeforeMax <= 0) return { action: "RUN", unreadyMediaFailed: input.mediaPending }

  const quiet = seconds(input.lastInboundAt, input.now)
  const wait = (delay: number): DebounceDecision => ({
    action: "WAIT",
    delaySeconds: Math.max(1, Math.ceil(Math.min(delay, leftBeforeMax))),
  })
  if (quiet < config.debounceSeconds) return wait(config.debounceSeconds - quiet)
  if (input.mediaPending) return wait(config.debounceSeconds)
  return { action: "RUN", unreadyMediaFailed: false }
}
