import { describe, expect, it } from 'vitest'
import { evaluatePoll, type PollItem } from '../poll-diff'

const OPEN = { muted: false, browserPermission: 'granted' as const }

function item(id: string, minute: number, read = false): PollItem {
  return { id, read, createdAt: new Date(Date.UTC(2026, 9, 19, 15, minute)).toISOString() }
}

function baseline(items: PollItem[], unreadCount = items.filter((i) => !i.read).length) {
  return evaluatePoll(null, { unreadCount, items }, OPEN).state
}

describe('evaluatePoll', () => {
  it('stays silent on the first poll, whatever the backlog', () => {
    const decision = evaluatePoll(null, { unreadCount: 3, items: [item('a', 1), item('b', 2), item('c', 3)] }, OPEN)

    expect(decision).toMatchObject({ newItems: [], playSound: false, showBrowserNotifications: false })
    expect(decision.state).toMatchObject({ unreadCount: 3, seenIds: ['a', 'b', 'c'] })
  })

  it('stays silent when nothing changed between polls', () => {
    const items = [item('b', 2), item('a', 1)]
    const state = baseline(items)

    const decision = evaluatePoll(state, { unreadCount: 2, items }, OPEN)

    expect(decision).toMatchObject({ newItems: [], playSound: false, showBrowserNotifications: false })
  })

  it('plays and notifies when a new notification id appears', () => {
    const state = baseline([item('a', 1)])
    const arrived = item('b', 2)

    const decision = evaluatePoll(state, { unreadCount: 2, items: [arrived, item('a', 1)] }, OPEN)

    expect(decision.newItems).toEqual([arrived])
    expect(decision.playSound).toBe(true)
    expect(decision.showBrowserNotifications).toBe(true)
  })

  it('announces each new id once, not on every following poll', () => {
    const first = baseline([item('a', 1)])
    const feed = { unreadCount: 2, items: [item('b', 2), item('a', 1)] }

    const second = evaluatePoll(first, feed, OPEN)
    const third = evaluatePoll(second.state, feed, OPEN)

    expect(second.playSound).toBe(true)
    expect(third).toMatchObject({ newItems: [], playSound: false, showBrowserNotifications: false })
  })

  it('plays when the unread counter goes up even if the new row is outside the window', () => {
    const items = [item('a', 1)]
    const state = baseline(items, 1)

    const decision = evaluatePoll(state, { unreadCount: 2, items }, OPEN)

    expect(decision.playSound).toBe(true)
    expect(decision.newItems).toEqual([])
    expect(decision.showBrowserNotifications).toBe(false) // nothing to describe
  })

  it('stays silent when the counter goes down (the user read something)', () => {
    const items = [item('b', 2), item('a', 1)]
    const state = baseline(items)

    const decision = evaluatePoll(state, { unreadCount: 1, items: [item('b', 2), item('a', 1, true)] }, OPEN)

    expect(decision).toMatchObject({ playSound: false, newItems: [] })
  })

  it('does not treat older unread rows that slide into the window as new', () => {
    // The window shows the newest two of three unread rows.
    const state = baseline([item('c', 3), item('b', 2)], 3)

    // The user reads c; the older row "a" slides into the window.
    const decision = evaluatePoll(
      state,
      { unreadCount: 2, items: [item('c', 3, true), item('b', 2), item('a', 1)] },
      OPEN
    )

    expect(decision).toMatchObject({ newItems: [], playSound: false, showBrowserNotifications: false })
  })

  it('treats a notification created again for a conversation that was read as new', () => {
    // The activity row for the conversation was read, so its dedup key was cleared and a new row arrives.
    const state = baseline([item('old', 1, true)], 0)

    const decision = evaluatePoll(state, { unreadCount: 1, items: [item('fresh', 5), item('old', 1, true)] }, OPEN)

    expect(decision.newItems.map((n) => n.id)).toEqual(['fresh'])
    expect(decision.playSound).toBe(true)
  })

  it('ignores new rows that are already read', () => {
    const state = baseline([item('a', 1)])

    const decision = evaluatePoll(state, { unreadCount: 0, items: [item('b', 2, true), item('a', 1, true)] }, OPEN)

    expect(decision.newItems).toEqual([])
    expect(decision.playSound).toBe(false)
  })

  it('respects the mute switch without losing the OS notification', () => {
    const state = baseline([item('a', 1)])
    const feed = { unreadCount: 2, items: [item('b', 2), item('a', 1)] }

    const decision = evaluatePoll(state, feed, { muted: true, browserPermission: 'granted' })

    expect(decision.playSound).toBe(false)
    expect(decision.showBrowserNotifications).toBe(true)
  })

  it.each(['default', 'denied', 'unsupported'] as const)(
    'raises no OS notification when the permission is %s, but still plays the sound',
    (browserPermission) => {
      const state = baseline([item('a', 1)])
      const feed = { unreadCount: 2, items: [item('b', 2), item('a', 1)] }

      const decision = evaluatePoll(state, feed, { muted: false, browserPermission })

      expect(decision.showBrowserNotifications).toBe(false)
      expect(decision.playSound).toBe(true)
    }
  )

  it('keeps the remembered ids bounded', () => {
    const many = Array.from({ length: 300 }, (_, i) => item(`n${i}`, i % 59))
    const state = baseline(many)

    expect(state.seenIds.length).toBeLessThanOrEqual(200)
  })
})
