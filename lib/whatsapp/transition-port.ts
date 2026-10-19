import prisma from "@/lib/db/prisma"

/**
 * Conversation transitions needed by the channel layer, behind a port. PR1.4 only needs
 * HUMAN_ECHO (a person answered from the phone app). The default adapter is a minimal
 * guarded status write plus its audit row; PR2.1 replaces it with the real state machine
 * (`setApplyTransitionPort`) so echo reconciliation does not change.
 */
export interface TransitionRequest {
  conversationId: string
  event: "HUMAN_ECHO"
  actor: "PHONE_APP"
  reason: string
}

/** Resolves true when the conversation actually changed state. */
export type ApplyTransition = (request: TransitionRequest) => Promise<boolean>

/** AI or ESCALATED -> HUMAN, with a version bump and a ConversationEvent (CH-8, CH-9). Anything else is a no-op. */
export const defaultApplyTransition: ApplyTransition = (request) =>
  prisma.$transaction(async (tx) => {
    const current = await tx.conversation.findUnique({
      where: { id: request.conversationId },
      select: { status: true },
    })
    if (!current || (current.status !== "AI" && current.status !== "ESCALATED")) return false

    // Guarded on the status we just read, so a concurrent transition wins cleanly.
    const { count } = await tx.conversation.updateMany({
      where: { id: request.conversationId, status: current.status },
      data: { status: "HUMAN", stateVersion: { increment: 1 } },
    })
    if (count === 0) return false

    await tx.conversationEvent.create({
      data: {
        conversationId: request.conversationId,
        fromStatus: current.status,
        toStatus: "HUMAN",
        event: request.event,
        actor: request.actor,
        reason: request.reason,
      },
    })
    return true
  })

let port: ApplyTransition = defaultApplyTransition

export function applyTransitionPort(request: TransitionRequest): Promise<boolean> {
  return port(request)
}

/** Registers the real implementation; pass nothing to restore the default. */
export function setApplyTransitionPort(next: ApplyTransition = defaultApplyTransition): void {
  port = next
}
