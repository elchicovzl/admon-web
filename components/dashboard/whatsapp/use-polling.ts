'use client'

import { useEffect, useRef } from 'react'
import { createSerializedRunner } from '@/lib/utils/serialized-runner'

/**
 * Calls `task` every `intervalMs` while the tab is visible (WI-5). Self-scheduling, so a slow
 * response never overlaps the next request, and returning to the tab polls right away instead
 * of waiting for the next tick. Errors are swallowed: the next tick simply tries again.
 */
export function usePolling(task: () => Promise<void>, intervalMs: number, enabled = true) {
  const taskRef = useRef(task)
  taskRef.current = task

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const run = createSerializedRunner(async () => {
      try {
        await taskRef.current()
      } catch {
        // Network blip: keep what is on screen.
      }
    })

    const schedule = () => {
      if (cancelled) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(tick, intervalMs)
    }
    const tick = async () => {
      if (!document.hidden) await run()
      schedule()
    }
    const onVisibility = () => {
      if (document.hidden) return
      void run()
      schedule()
    }

    document.addEventListener('visibilitychange', onVisibility)
    schedule()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs, enabled])
}
