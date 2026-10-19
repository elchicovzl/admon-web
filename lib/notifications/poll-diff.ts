/**
 * Decides, for each poll of the notification feed, whether to play the sound and whether to
 * raise OS notifications. Pure so the rules are testable without a browser.
 *
 * A poll only counts as "something new" when a notification this tab has not seen appears
 * AND it is not older than the newest one already seen, or when the unread counter goes up.
 * The age check matters: the feed is a capped window, so reading the newest rows makes older
 * unread ones slide into view, and those must stay silent. The first poll only sets the
 * baseline, so opening the dashboard never beeps for a backlog.
 */

export type BrowserPermission = 'granted' | 'denied' | 'default' | 'unsupported'

export interface PollItem {
  id: string
  read: boolean
  /** ISO timestamp. */
  createdAt: string
}

export interface PollState {
  seenIds: string[]
  unreadCount: number
  latestMs: number
}

export interface PollOptions {
  muted: boolean
  browserPermission: BrowserPermission
}

export interface PollDecision<T extends PollItem> {
  state: PollState
  /** Unread notifications this tab has not announced yet. */
  newItems: T[]
  playSound: boolean
  showBrowserNotifications: boolean
}

/** Bounded memory for a tab left open for days. */
const MAX_SEEN_IDS = 200

export function evaluatePoll<T extends PollItem>(
  previous: PollState | null,
  current: { unreadCount: number; items: T[] },
  options: PollOptions
): PollDecision<T> {
  const timestamps = current.items.map((item) => Date.parse(item.createdAt)).filter(Number.isFinite)
  const newestInFeed = timestamps.length > 0 ? Math.max(...timestamps) : 0

  if (!previous) {
    return {
      state: {
        seenIds: current.items.map((item) => item.id).slice(0, MAX_SEEN_IDS),
        unreadCount: current.unreadCount,
        latestMs: newestInFeed,
      },
      newItems: [],
      playSound: false,
      showBrowserNotifications: false,
    }
  }

  const seen = new Set(previous.seenIds)
  const newItems = current.items.filter(
    (item) => !item.read && !seen.has(item.id) && Date.parse(item.createdAt) >= previous.latestMs
  )
  const counterWentUp = current.unreadCount > previous.unreadCount

  const seenIds = [...current.items.map((item) => item.id), ...previous.seenIds]
  return {
    state: {
      seenIds: [...new Set(seenIds)].slice(0, MAX_SEEN_IDS),
      unreadCount: current.unreadCount,
      latestMs: Math.max(previous.latestMs, newestInFeed),
    },
    newItems,
    playSound: !options.muted && (newItems.length > 0 || counterWentUp),
    showBrowserNotifications: options.browserPermission === 'granted' && newItems.length > 0,
  }
}
