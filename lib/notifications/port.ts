/**
 * Notification port. Producers (lead creation here, escalations in later PRs) depend on
 * this interface only. The default adapter is a no-op that logs one line with ids and no
 * personal data; PR4.1 registers the real fan-out with `setNotifyPort` (design D-ORD1).
 */
export type NotifyEvent =
  | { type: "NEW_LEAD"; leadId: string; contactId: string; conversationId?: string | null }
  | { type: "NEW_ACTIVITY_ON_ESCALATED"; conversationId: string }

export interface NotifyPort {
  notify(event: NotifyEvent): Promise<void>
}

export const noopNotifyPort: NotifyPort = {
  async notify(event) {
    const ref = event.type === "NEW_LEAD" ? `lead=${event.leadId}` : `conversation=${event.conversationId}`
    console.info(`[notify] ${event.type} ${ref} (no-op port)`)
  },
}

let port: NotifyPort = noopNotifyPort

export function getNotifyPort(): NotifyPort {
  return port
}

/** Registers the real implementation; pass nothing to restore the no-op default. */
export function setNotifyPort(next: NotifyPort = noopNotifyPort): void {
  port = next
}
