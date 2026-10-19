'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/actions/notification.actions'
import { browserNotificationSpec } from '@/lib/notifications/present'
import { evaluatePoll, type BrowserPermission, type PollState } from '@/lib/notifications/poll-diff'
import { readMuted, writeMuted } from '@/lib/notifications/preferences'
import type { NotificationFeed } from '@/lib/types/notification.types'
import {
  getBrowserPermission,
  requestBrowserPermission,
  showBrowserNotification,
} from './browser-notifications'
import { playChime, unlockAudio } from './notification-sound'

export const NOTIFICATION_POLL_INTERVAL_MS = 4000

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/**
 * Polls the feed every ~4 s and reacts to what is new: chime and OS notifications fire only
 * when `evaluatePoll` says so (never on the first poll, never on every poll). The loop is
 * self-scheduling, so a slow response can never overlap the next request.
 */
export function useNotificationFeed(userId: string) {
  const router = useRouter()
  const [feed, setFeed] = useState<NotificationFeed | null>(null)
  const [muted, setMutedState] = useState(false)
  const [permission, setPermission] = useState<BrowserPermission>('unsupported')

  const pollState = useRef<PollState | null>(null)
  const mutedRef = useRef(false)
  const permissionRef = useRef<BrowserPermission>('unsupported')
  const routerRef = useRef(router)
  routerRef.current = router

  // Preferences live in the browser, so they are read after mount.
  useEffect(() => {
    const initialMuted = readMuted(storage(), userId)
    mutedRef.current = initialMuted
    setMutedState(initialMuted)
    const initialPermission = getBrowserPermission()
    permissionRef.current = initialPermission
    setPermission(initialPermission)
  }, [userId])

  // Autoplay policy: the first click or key press unlocks the audio context.
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const refresh = useCallback(async () => {
    const result = await listNotifications()
    if (!result.success || !result.data) return

    const decision = evaluatePoll(pollState.current, result.data, {
      muted: mutedRef.current,
      browserPermission: permissionRef.current,
    })
    pollState.current = decision.state
    setFeed(result.data)

    if (decision.playSound) playChime()
    if (decision.showBrowserNotifications) {
      for (const item of decision.newItems) {
        showBrowserNotification(browserNotificationSpec(item), (link) => routerRef.current.push(link))
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = async () => {
      try {
        await refresh()
      } catch {
        // Network blip: keep the last feed and try again on the next tick.
      }
      if (!cancelled) timer = setTimeout(tick, NOTIFICATION_POLL_INTERVAL_MS)
    }
    void tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [refresh])

  const setMuted = useCallback(
    (next: boolean) => {
      mutedRef.current = next
      setMutedState(next)
      writeMuted(storage(), userId, next)
      unlockAudio()
    },
    [userId]
  )

  const enableBrowserNotifications = useCallback(async () => {
    const next = await requestBrowserPermission()
    permissionRef.current = next
    setPermission(next)
  }, [])

  const markRead = useCallback(
    async (id: string) => {
      setFeed((current) => {
        if (!current) return current
        const target = current.items.find((item) => item.id === id)
        if (!target || target.read) return current
        return {
          unreadCount: Math.max(0, current.unreadCount - 1),
          items: current.items.map((item) => (item.id === id ? { ...item, read: true } : item)),
        }
      })
      await markNotificationRead({ id })
      await refresh()
    },
    [refresh]
  )

  const markAllRead = useCallback(async () => {
    setFeed((current) =>
      current ? { unreadCount: 0, items: current.items.map((item) => ({ ...item, read: true })) } : current
    )
    await markAllNotificationsRead()
    await refresh()
  }, [refresh])

  return { feed, muted, setMuted, permission, enableBrowserNotifications, markRead, markAllRead }
}
