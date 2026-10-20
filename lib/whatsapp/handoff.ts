import type { ConversationMarker, ConversationSummary } from '@/lib/types/whatsapp.types'

/** Longest optional reason accepted when closing a conversation. */
export const CLOSE_REASON_MAX_LENGTH = 300

export interface HandoffOptions {
  take: boolean
  returnToAi: boolean
  close: boolean
  reopen: boolean
  pauseAi: boolean
  link: boolean
  unlink: boolean
  confirmUnknown: boolean
}

/**
 * Which header actions a conversation offers. It mirrors the state machine (D9) so the UI never
 * shows a button the server would reject; the server still decides (a concurrent change can
 * make an offered action fail, and the action then reports it).
 */
export function handoffOptions(
  conversation: Pick<ConversationSummary, 'status' | 'clientId'> & { markers: readonly ConversationMarker[] }
): HandoffOptions {
  const { status, clientId } = conversation
  const open = status !== 'CLOSED'
  return {
    take: status === 'AI' || status === 'ESCALATED',
    returnToAi: status === 'HUMAN',
    close: open,
    reopen: !open,
    pauseAi: open,
    link: clientId === null,
    unlink: clientId !== null,
    confirmUnknown: clientId === null && conversation.markers.includes('AMBIGUOUS'),
  }
}
