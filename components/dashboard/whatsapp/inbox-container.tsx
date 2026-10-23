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
import { useDebouncedValue } from './use-debounced-value'
import { usePolling } from './use-polling'
import { useHandoffActions } from './use-handoff-actions'
import { useThreadActions } from './use-thread-actions'

/** Same cadence as the notification bell. */
export const INBOX_POLL_INTERVAL_MS = 4000
/** Wait for the user to stop typing before querying. */
export const SEARCH_DEBOUNCE_MS = 300

const LIST_ERROR = 'No se pudo cargar la lista de conversaciones'
const THREAD_ERROR = 'No se pudo cargar la conversación'

/** The list query for a filter tab: a state, only unread, or everything. */
function filterInput(filter: InboxFilter): { state?: Exclude<InboxFilter, 'ALL' | 'UNREAD'>; unread?: true } {
  if (filter === 'ALL') return {}
  if (filter === 'UNREAD') return { unread: true }
  return { state: filter }
}

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
  const [searchInput, setSearchInput] = useState('')
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  // The open conversation can fall out of a search; its header still needs a summary.
  const [openSummary, setOpenSummary] = useState<ConversationSummary | null>(null)
  const [thread, setThread] = useState<ThreadState | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [threadReload, setThreadReload] = useState(0)

  const cursorRef = useRef(initial.cursor)
  const selectedRef = useRef(selectedId)
  const threadRef = useRef(thread)
  const filterRef = useRef(filter)
  const conversationsRef = useRef(conversations)
  selectedRef.current = selectedId
  threadRef.current = thread
  filterRef.current = filter
  conversationsRef.current = conversations

  // The query actually applied: trimmed and debounced. Polling and paging read it from the ref.
  const query = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS).trim()
  const queryRef = useRef('')

  /** `silent` refreshes in place (polling): no skeleton and no error banner. */
  const reloadList = useCallback(async (next: InboxFilter, text: string, silent = false) => {
    if (!silent) {
      setListLoading(true)
      setListError(null)
    }
    const result = await listConversations({
      ...filterInput(next),
      ...(text ? { q: text } : {}),
    })
    // A newer filter or query choice wins over a slow answer.
    if (filterRef.current !== next || queryRef.current !== text) return
    if (result.success && result.data) {
      setConversations(sortConversations(result.data.items))
      setNextCursor(result.data.nextCursor)
      cursorRef.current = result.data.cursor
    } else if (!silent) {
      setListError(result.error ?? LIST_ERROR)
    }
    if (!silent) setListLoading(false)
  }, [])

  const changeFilter = (next: InboxFilter) => {
    if (next === filter) return
    filterRef.current = next
    setFilter(next)
    void reloadList(next, queryRef.current)
  }

  // A new (debounced) query reloads the list; the first render already has the unfiltered page.
  useEffect(() => {
    if (query === queryRef.current) return
    queryRef.current = query
    void reloadList(filterRef.current, query)
  }, [query, reloadList])

  const loadMore = async () => {
    if (!nextCursor) return
    setLoadingMore(true)
    const text = queryRef.current
    const result = await listConversations({
      cursor: nextCursor,
      ...filterInput(filter),
      ...(text ? { q: text } : {}),
    })
    // Ignore a page that belongs to a query the user already left.
    if (queryRef.current !== text) {
      setLoadingMore(false)
      return
    }
    if (result.success && result.data) {
      const page = result.data
      setConversations((current) => mergeConversations(current, page.items))
      setNextCursor(page.nextCursor)
    }
    setLoadingMore(false)
  }

  /**
   * Applies fresh rows to the list. While a query is active only rows already shown are updated:
   * rows the query did not return must not appear just because they changed.
   */
  const applyRows = useCallback((rows: ConversationSummary[]) => {
    setConversations((current) => {
      if (!queryRef.current) return mergeConversations(current, rows)
      const shown = new Set(current.map((item) => item.id))
      return mergeConversations(
        current,
        rows.filter((item) => shown.has(item.id))
      )
    })
  }, [])

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
      setOpenSummary(data.conversation)
      applyRows([data.conversation])
      markRead(selectedId)
    })()

    return () => {
      cancelled = true
    }
  }, [selectedId, threadReload, markRead, applyRows])

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
      await reloadList(filterRef.current, queryRef.current)
      return
    }
    cursorRef.current = data.cursor
    applyRows(data.conversations)
    const opened = openId ? data.conversations.find((item) => item.id === openId) : undefined
    if (opened) setOpenSummary(opened)
    if (queryRef.current) {
      // An unknown conversation may be a new match: re-run the query quietly. The open one is
      // excluded so an active chat that does not match cannot trigger a reload on every poll.
      const shown = new Set(conversationsRef.current.map((item) => item.id))
      if (data.conversations.some((item) => item.id !== openId && !shown.has(item.id))) {
        void reloadList(filterRef.current, queryRef.current, true)
      }
    }

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
  }, [reloadList, markRead, applyRows])

  usePolling(poll, INBOX_POLL_INTERVAL_MS)

  const actions = useThreadActions({ conversationId: selectedId, onChanged: poll })
  /** A header action returns the fresh row: show it now instead of waiting for the next poll. */
  const applyActionResult = useCallback(
    (summary: ConversationSummary) => {
      applyRows([summary])
      setOpenSummary((current) => (current && current.id === summary.id ? summary : current))
    },
    [applyRows]
  )
  const handoff = useHandoffActions({ conversationId: selectedId, onUpdated: applyActionResult })

  const selected =
    conversations.find((item) => item.id === selectedId) ??
    (openSummary && openSummary.id === selectedId ? openSummary : null)
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
          search={searchInput}
          onSearchChange={setSearchInput}
          query={query}
          selectedId={selectedId}
          onSelect={writeSelection}
          loading={listLoading}
          error={listError}
          onRetry={() => void reloadList(filter, queryRef.current)}
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
          handoff={handoff}
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
