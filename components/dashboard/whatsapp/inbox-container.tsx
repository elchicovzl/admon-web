'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { markConversationNotificationsRead } from '@/lib/actions/notification.actions'
import {
  getConversationThread,
  getUpdates,
  listConversations,
  markConversationRead,
} from '@/lib/actions/whatsapp.actions'
import type { ConversationListPage, ConversationSummary } from '@/lib/types/whatsapp.types'
import type { TemplateOption } from '@/lib/whatsapp/templates'
import {
  hasNewInbound,
  mergeConversations,
  mergeMessages,
  parseConversationParam,
  sortConversations,
  threadCursorOf,
} from '@/lib/whatsapp/inbox'
import { ConversationList, type InboxFilter } from './conversation-list'
import { ResendConfirmDialog } from './resend-confirm-dialog'
import { ThreadView, type ThreadState } from './thread-view'
import { useNow } from './use-now'
import { usePolling } from './use-polling'
import { useThreadActions } from './use-thread-actions'

/** Same cadence as the notification bell. */
export const INBOX_POLL_INTERVAL_MS = 4000

const LIST_ERROR = 'No se pudo cargar la lista de conversaciones'
const THREAD_ERROR = 'No se pudo cargar la conversación'

/** Keeps `?c=` in the URL without a server round trip (Next syncs useSearchParams). */
function writeSelection(id: string | null) {
  const url = new URL(window.location.href)
  if (id) url.searchParams.set('c', id)
  else url.searchParams.delete('c')
  window.history.replaceState(null, '', `${url.pathname}${url.search}`)
}

/**
 * Container of the inbox: owns the state, the polling and the actions. Everything it renders is
 * presentational (`ConversationList`, `ThreadView`). The selection lives in the URL (`?c=`),
 * which is also where the notification bell links to.
 */
export function InboxContainer({
  initial,
  templates,
}: {
  initial: ConversationListPage
  /** Approved templates the composer may offer when the 24 h window is closed. */
  templates: TemplateOption[]
}) {
  const searchParams = useSearchParams()
  const selectedId = parseConversationParam(searchParams.get('c'))
  const now = useNow()

  const [conversations, setConversations] = useState<ConversationSummary[]>(() =>
    sortConversations(initial.items)
  )
  const [nextCursor, setNextCursor] = useState<string | null>(initial.nextCursor)
  const [filter, setFilter] = useState<InboxFilter>('ALL')
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [thread, setThread] = useState<ThreadState | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [threadReload, setThreadReload] = useState(0)

  const cursorRef = useRef(initial.cursor)
  const selectedRef = useRef(selectedId)
  const threadRef = useRef(thread)
  const filterRef = useRef(filter)
  selectedRef.current = selectedId
  threadRef.current = thread
  filterRef.current = filter

  const reloadList = useCallback(async (next: InboxFilter) => {
    setListLoading(true)
    setListError(null)
    const result = await listConversations(next === 'ALL' ? {} : { state: next })
    // A newer filter choice wins over a slow answer.
    if (filterRef.current !== next) return
    if (result.success && result.data) {
      setConversations(sortConversations(result.data.items))
      setNextCursor(result.data.nextCursor)
      cursorRef.current = result.data.cursor
    } else {
      setListError(result.error ?? LIST_ERROR)
    }
    setListLoading(false)
  }, [])

  const changeFilter = (next: InboxFilter) => {
    if (next === filter) return
    filterRef.current = next
    setFilter(next)
    void reloadList(next)
  }

  const loadMore = async () => {
    if (!nextCursor) return
    setLoadingMore(true)
    const state = filter === 'ALL' ? undefined : filter
    const result = await listConversations({ cursor: nextCursor, ...(state ? { state } : {}) })
    if (result.success && result.data) {
      const page = result.data
      setConversations((current) => mergeConversations(current, page.items))
      setNextCursor(page.nextCursor)
    }
    setLoadingMore(false)
  }

  /** Opening a thread (and new customer messages in an open one) clears the unread markers. */
  const markRead = useCallback((conversationId: string) => {
    void markConversationNotificationsRead({ conversationId })
    void markConversationRead({ conversationId })
    setConversations((current) =>
      current.map((item) => (item.id === conversationId ? { ...item, unreadCount: 0 } : item))
    )
  }, [])

  // Load the thread whenever the selection (or an explicit retry) changes.
  useEffect(() => {
    if (!selectedId) {
      setThread(null)
      return
    }
    let cancelled = false
    setThread({ conversationId: selectedId, messages: [], hasMore: false, status: 'loading', error: null })

    void (async () => {
      const result = await getConversationThread({ conversationId: selectedId })
      if (cancelled) return
      if (!result.success || !result.data) {
        setThread({
          conversationId: selectedId,
          messages: [],
          hasMore: false,
          status: 'error',
          error: result.error ?? THREAD_ERROR,
        })
        return
      }
      const data = result.data
      setThread({
        conversationId: selectedId,
        messages: data.messages,
        hasMore: data.hasMore,
        status: 'ready',
        error: null,
      })
      setConversations((current) => mergeConversations(current, [data.conversation]))
      markRead(selectedId)
    })()

    return () => {
      cancelled = true
    }
  }, [selectedId, threadReload, markRead])

  const loadOlder = async () => {
    const current = threadRef.current
    if (!current || current.status !== 'ready' || current.messages.length === 0) return
    setLoadingOlder(true)
    const result = await getConversationThread({
      conversationId: current.conversationId,
      before: threadCursorOf(current.messages[0]),
    })
    if (result.success && result.data && selectedRef.current === current.conversationId) {
      const data = result.data
      setThread((latest) =>
        latest && latest.conversationId === current.conversationId
          ? { ...latest, messages: mergeMessages(latest.messages, data.messages), hasMore: data.hasMore }
          : latest
      )
    }
    setLoadingOlder(false)
  }

  const poll = useCallback(async () => {
    const openId = selectedRef.current
    const result = await getUpdates({
      updatedSince: cursorRef.current,
      ...(openId ? { conversationId: openId } : {}),
    })
    if (!result.success || !result.data) return
    const data = result.data

    // The selection moved, or its thread is still loading: applying this would race the load.
    // The cursor stays put, so the next poll repeats the window instead of skipping it.
    if (selectedRef.current !== openId) return
    if (openId && threadRef.current?.status !== 'ready') return

    if (data.truncated) {
      await reloadList(filterRef.current)
      return
    }
    cursorRef.current = data.cursor
    setConversations((current) => mergeConversations(current, data.conversations))

    const open = threadRef.current
    if (openId && open && open.conversationId === openId && data.messages.length > 0) {
      const arrived = hasNewInbound(open.messages, data.messages)
      setThread((latest) =>
        latest && latest.conversationId === openId
          ? { ...latest, messages: mergeMessages(latest.messages, data.messages) }
          : latest
      )
      if (arrived) markRead(openId)
    }
  }, [reloadList, markRead])

  usePolling(poll, INBOX_POLL_INTERVAL_MS)

  const actions = useThreadActions({ conversationId: selectedId, onChanged: poll })

  const selected = conversations.find((item) => item.id === selectedId) ?? null
  const showThreadOnMobile = selectedId !== null

  return (
    <div className="flex h-[calc(100dvh-12rem)] min-h-[28rem] overflow-hidden rounded-lg border bg-card">
      <aside
        className={`${showThreadOnMobile ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r md:w-80 lg:w-96`}
      >
        <ConversationList
          items={conversations}
          filter={filter}
          onFilterChange={changeFilter}
          selectedId={selectedId}
          onSelect={writeSelection}
          loading={listLoading}
          error={listError}
          onRetry={() => void reloadList(filter)}
          canLoadMore={nextCursor !== null}
          loadingMore={loadingMore}
          onLoadMore={() => void loadMore()}
          now={now}
        />
      </aside>
      <section className={`${showThreadOnMobile ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
        <ThreadView
          conversation={selected}
          thread={thread}
          now={now}
          loadingOlder={loadingOlder}
          onBack={() => writeSelection(null)}
          onLoadOlder={() => void loadOlder()}
          onRetry={() => setThreadReload((value) => value + 1)}
          composer={{
            sending: actions.sending,
            templates,
            onSendText: actions.sendText,
            onSendTemplate: actions.sendTemplate,
            onSendAttachment: actions.sendAttachment,
          }}
          onResend={actions.resend}
        />
      </section>
      <ResendConfirmDialog
        open={actions.confirming !== null}
        onConfirm={actions.confirmResend}
        onCancel={actions.cancelResend}
      />
    </div>
  )
}
