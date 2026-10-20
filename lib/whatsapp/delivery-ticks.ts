import type { MessageStatus } from '@prisma/client'
import { deliveryLabel } from './inbox'

/**
 * WhatsApp-style delivery marks for outgoing bubbles (PR2.2c). Pure: the component maps `icon`
 * to a lucide icon and `tone` to a color class.
 */

export type TickIcon = 'clock' | 'check' | 'check-check' | 'alert'
export type TickTone = 'muted' | 'read' | 'error'

export interface DeliveryTick {
  icon: TickIcon
  tone: TickTone
  /** Spanish text for aria-label and tooltip ("Leído"). */
  label: string
}

/** Null for RECEIVED: that status belongs to inbound messages and never shows a mark. */
export function deliveryTick(status: MessageStatus): DeliveryTick | null {
  const label = deliveryLabel(status)
  switch (status) {
    case 'QUEUED':
      return { icon: 'clock', tone: 'muted', label }
    case 'SENT':
      return { icon: 'check', tone: 'muted', label }
    case 'DELIVERED':
      return { icon: 'check-check', tone: 'muted', label }
    case 'READ':
      return { icon: 'check-check', tone: 'read', label }
    case 'FAILED':
      return { icon: 'alert', tone: 'error', label }
    case 'RECEIVED':
      return null
  }
}

/**
 * Colors per tone. `onPrimary` is the dashboard bubble (`bg-primary`), which is dark in the light
 * theme and light in the dark theme, so its marks use the foreground color and theme-flipped
 * shades; the other bubbles are light tints in both themes.
 */
export function tickColorClass(tone: TickTone, onPrimary: boolean): string {
  if (onPrimary) {
    switch (tone) {
      case 'muted':
        return 'text-primary-foreground/70'
      case 'read':
        return 'text-sky-400 dark:text-sky-600'
      case 'error':
        return 'text-red-400 dark:text-red-600'
    }
  }
  switch (tone) {
    case 'muted':
      return 'text-muted-foreground'
    case 'read':
      return 'text-sky-600 dark:text-sky-400'
    case 'error':
      return 'text-destructive'
  }
}
