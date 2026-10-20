'use client'

import { useCallback, useEffect, useState } from 'react'
import { getUnreadNotificationCount } from '@/lib/actions/notification.actions'
import { formatBadgeCount } from '@/lib/whatsapp/inbox'
import { usePolling } from './use-polling'

/** Slower than the bell (4 s): the sidebar only needs a coarse "something is waiting". */
export const SIDEBAR_BADGE_POLL_INTERVAL_MS = 15_000

/**
 * Unread WhatsApp notifications (escalations, new activity on escalated chats, new leads) next
 * to the "WhatsApp" sidebar entry. It reuses the per-user count action, which is the one that
 * the bell reads, so the number matches. The sidebar only mounts it for users with access, and
 * the action checks access again on every call. Polls only while the tab is visible.
 */
export function WhatsAppSidebarBadge() {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    const result = await getUnreadNotificationCount()
    // A failed poll keeps the last number instead of flashing to zero.
    if (result.success && result.data) setCount(result.data.count)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  usePolling(refresh, SIDEBAR_BADGE_POLL_INTERVAL_MS)

  const label = formatBadgeCount(count)
  if (!label) return null

  return (
    <span
      className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-white"
      aria-label={`${count} notificaciones de WhatsApp sin leer`}
    >
      {label}
    </span>
  )
}
