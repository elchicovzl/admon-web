/**
 * Per-user sound preference, kept in localStorage. Storage is injected so the logic is
 * testable, and every access is guarded: private mode or a blocked storage must never break
 * the dashboard header.
 */

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'setItem'>

export function mutedStorageKey(userId: string): string {
  return `admon:wa-notifications-muted:${userId}`
}

export function readMuted(storage: ReadableStorage | null | undefined, userId: string): boolean {
  try {
    return storage?.getItem(mutedStorageKey(userId)) === '1'
  } catch {
    return false
  }
}

export function writeMuted(storage: WritableStorage | null | undefined, userId: string, muted: boolean): void {
  try {
    storage?.setItem(mutedStorageKey(userId), muted ? '1' : '0')
  } catch {
    // Not persisted; the in-memory toggle still works for this session.
  }
}
