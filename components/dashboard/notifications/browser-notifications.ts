import type { BrowserNotificationSpec } from '@/lib/notifications/present'
import type { BrowserPermission } from '@/lib/notifications/poll-diff'

/**
 * Thin wrapper over the Notification API. Permission is requested only from a user gesture
 * (the "Activar notificaciones del navegador" button), never on page load.
 */

export function getBrowserPermission(): BrowserPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

/** Must be called from a click handler. */
export async function requestBrowserPermission(): Promise<BrowserPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return getBrowserPermission()
  }
}

/**
 * Shows an OS notification; clicking it focuses this tab and opens the link. Skipped while the
 * dashboard is visible: the bell's sound and badge already cover that case.
 */
export function showBrowserNotification(spec: BrowserNotificationSpec, open: (link: string) => void): void {
  if (getBrowserPermission() !== 'granted') return
  if (document.visibilityState === 'visible') return
  try {
    // `renotify` makes a replaced notification (same tag) alert again; it is missing from older DOM typings.
    const options: NotificationOptions & { renotify?: boolean } = {
      body: spec.body,
      tag: spec.tag,
      renotify: true,
    }
    const notification = new Notification(spec.title, options)
    notification.onclick = () => {
      window.focus()
      notification.close()
      open(spec.link)
    }
  } catch {
    // Some browsers (Android Chrome) only allow notifications from a service worker.
  }
}
