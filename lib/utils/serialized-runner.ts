/**
 * Serializes an async task so two runs never overlap.
 *
 * - Idle: the call starts the task right away.
 * - Busy: the call joins ONE follow-up run that starts when the current one settles. Any number
 *   of calls made while busy share that single follow-up, so a burst costs at most one extra run.
 *
 * The follow-up (rather than reusing the in-flight run) matters for callers that just wrote
 * something and need a read that started AFTER the write. A failed run rejects only the callers
 * waiting on it; it never blocks the next run.
 */
export function createSerializedRunner(task: () => Promise<void>): () => Promise<void> {
  let inFlight: Promise<void> | null = null
  let queued: Promise<void> | null = null

  const start = (): Promise<void> => {
    const run = task()
    inFlight = run
    const release = () => {
      if (inFlight === run) inFlight = null
    }
    run.then(release, release)
    return run
  }

  return () => {
    if (!inFlight) return start()
    if (!queued) {
      const go = () => {
        queued = null
        return start()
      }
      queued = inFlight.then(go, go)
    }
    return queued
  }
}
