'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getAttentionFeed,
  markAllAttentionRead,
  markAttentionRead,
  replyAttentionRequest,
} from '@/lib/actions/attention-request.actions'
import type { AttentionFeed } from '@/lib/types/attention-request.types'
import { usePolling } from '@/components/dashboard/whatsapp/use-polling'

export const ATTENTION_POLL_INTERVAL_MS = 30_000

/**
 * Feed of the header attention bell: requests sent to me and replies to my requests.
 * Polls only while the tab is visible (see usePolling) and refreshes when the popover opens.
 */
export function useAttentionFeed() {
  const [feed, setFeed] = useState<AttentionFeed | null>(null)

  const refresh = useCallback(async () => {
    const result = await getAttentionFeed()
    if (result.success && result.data) setFeed(result.data)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  usePolling(refresh, ATTENTION_POLL_INTERVAL_MS)

  const markRead = useCallback(
    async (id: string) => {
      setFeed((current) => {
        if (!current) return current
        const target = current.items.find((item) => item.id === id && !item.read)
        if (!target) return current
        return {
          unreadCount: Math.max(0, current.unreadCount - 1),
          items: current.items.map((item) => (item.id === id ? { ...item, read: true } : item)),
        }
      })
      await markAttentionRead({ id })
      await refresh()
    },
    [refresh]
  )

  const markAllRead = useCallback(async () => {
    setFeed((current) =>
      current ? { unreadCount: 0, items: current.items.map((item) => ({ ...item, read: true })) } : current
    )
    await markAllAttentionRead()
    await refresh()
  }, [refresh])

  const reply = useCallback(
    async (id: string, text: string) => {
      const result = await replyAttentionRequest({ id, reply: text })
      await refresh()
      return result
    },
    [refresh]
  )

  return { feed, refresh, markRead, markAllRead, reply }
}
