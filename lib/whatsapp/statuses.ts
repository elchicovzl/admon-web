import { Prisma, type MessageStatus } from "@prisma/client"
import prisma from "@/lib/db/prisma"

/**
 * Delivery status ordering. A status only ever moves a message to a higher rank, so a
 * late "delivered" never overwrites "read" (WC-7, S-WC-7). FAILED outranks everything
 * and is therefore terminal: nothing can overwrite it.
 */
const STATUS_RANK: Record<MessageStatus, number> = {
  RECEIVED: 0,
  QUEUED: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  FAILED: 4,
}

export function statusRank(status: MessageStatus): number {
  return STATUS_RANK[status]
}

const META_STATUS: Record<string, MessageStatus> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
}

/** Maps Meta's lowercase status string; null for statuses we do not track (e.g. "deleted"). */
export function parseMetaStatus(value: string): MessageStatus | null {
  return META_STATUS[value.toLowerCase()] ?? null
}

export interface StatusInput {
  wamid: string
  status: MessageStatus
  timestamp: Date
  errorCode?: string | null
  errorTitle?: string | null
}

/**
 * Applies one status to the message that owns the wamid, monotonically. Matches zero
 * rows when the message does not exist yet (status arrived first) or already has an
 * equal/higher status; both are fine and idempotent.
 */
export async function applyStatusToMessage(input: StatusInput): Promise<number> {
  const rank = statusRank(input.status)
  const failed = input.status === "FAILED"
  const { count } = await prisma.whatsAppMessage.updateMany({
    where: { wamid: input.wamid, statusRank: { lt: rank } },
    data: {
      status: input.status,
      statusRank: rank,
      ...(input.status === "SENT" ? { sentAt: input.timestamp } : {}),
      ...(failed ? { errorCode: input.errorCode ?? null, errorMessage: input.errorTitle ?? null } : {}),
    },
  })
  return count
}

/**
 * Stores the status in the history table (unique per wamid + status, so redeliveries are
 * no-ops) and applies it to the message when one exists.
 */
export async function recordAndApplyStatus(input: StatusInput): Promise<void> {
  try {
    await prisma.whatsAppStatusEvent.createMany({
      data: [
        {
          wamid: input.wamid,
          status: input.status,
          errorCode: input.errorCode ?? null,
          errorTitle: input.errorTitle ?? null,
          timestamp: input.timestamp,
        },
      ],
      skipDuplicates: true,
    })
  } catch (error) {
    // A racing delivery of the same (wamid, status) is not a failure.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error
  }
  await applyStatusToMessage(input)
}

/**
 * Applies the highest stored status to a message that just received its wamid (outbound
 * send in PR1.4, phone-app echo insert). This is how a status that arrived before its
 * message is reconciled, with no polling.
 */
export async function applyStoredStatuses(wamid: string): Promise<void> {
  const stored = await prisma.whatsAppStatusEvent.findMany({
    where: { wamid },
    select: { status: true, errorCode: true, errorTitle: true, timestamp: true },
  })
  if (stored.length === 0) return
  const top = stored.reduce((best, current) =>
    statusRank(current.status) > statusRank(best.status) ? current : best
  )
  await applyStatusToMessage({ wamid, ...top })
}
