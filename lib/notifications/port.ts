/**
 * Notification port. Producers (lead creation here, escalations in later PRs) depend on
 * this interface only. The default adapter is a no-op that logs one line with ids and no
 * personal data; `notify.ts` is the real fan-out, registered with `setNotifyPort` by the worker bootstrap (design D-ORD1).
 */
export type NotifyEvent =
  | { type: "NEW_LEAD"; leadId: string; contactId: string; conversationId?: string | null }
  | { type: "NEW_ACTIVITY_ON_ESCALATED"; conversationId: string }
  /** `escalatedAt` identifies the transition, so a retried emit cannot notify twice. */
  | { type: "ESCALATION"; conversationId: string; escalatedAt: Date }
  | { type: "AI_FAILURE"; conversationId: string }
  | { type: "DRAFT_PENDING_REVIEW"; draftId: string; conversationId?: string | null }

export interface NotifyPort {
  notify(event: NotifyEvent): Promise<void>
}

export const noopNotifyPort: NotifyPort = {
  async notify(event) {
    const ref =
      event.type === "NEW_LEAD"
        ? `lead=${event.leadId}`
        : event.type === "DRAFT_PENDING_REVIEW"
          ? `draft=${event.draftId}`
          : `conversation=${event.conversationId}`
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
