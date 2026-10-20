'use client'

import { useEffect, useState } from 'react'

/**
 * Current time, refreshed every `intervalMs`. Null until mounted so server and client render the
 * same markup; time-dependent labels (window countdown, "Atender: ...") simply appear after mount.
 */
export function useNow(intervalMs = 60_000): Date | null {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}
