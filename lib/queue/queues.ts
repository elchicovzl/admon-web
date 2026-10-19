import type { Queue, SendOptions } from "pg-boss"

/** Dead-letter queue: exhausted jobs land here for operator inspection (WC-5, DR-8). */
export const DEAD_LETTER_QUEUE = "wa.dead"

export const QUEUES = {
  EVENT_PROCESS: "wa.event.process",
  EVENT_SWEEP: "wa.event.sweep",
  MESSAGE_SEND: "wa.message.send",
  ECHO_RECONCILE: "wa.echo.reconcile",
  MEDIA_DOWNLOAD: "wa.media.download",
  AI_TRANSCRIBE: "ai.transcribe",
  AI_TURN: "ai.turn",
  KB_INGEST: "kb.ingest",
  NOTIFY_EMAIL: "notify.email",
  RETENTION_PURGE: "retention.purge",
  AFFILIATION_DRAFT_MATERIALIZE: "affiliation.draft.materialize",
} as const

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]

export interface QueueDefinition {
  name: QueueName
  /** Defaults to pg-boss `standard`. */
  policy?: Queue["policy"]
  retryLimit: number
  retryDelay: number
  retryBackoff: boolean
  deadLetter: typeof DEAD_LETTER_QUEUE
}

/** Queue topology (design D2). Every queue retries with backoff and dead-letters to `wa.dead`. */
export const QUEUE_DEFINITIONS: readonly QueueDefinition[] = [
  // Singleton semantics come from the per-job singletonKey = event id (see QUEUE_SEND_DEFAULTS).
  { name: QUEUES.EVENT_PROCESS, retryLimit: 5, retryDelay: 10, retryBackoff: true, deadLetter: DEAD_LETTER_QUEUE },
  { name: QUEUES.EVENT_SWEEP, retryLimit: 1, retryDelay: 30, retryBackoff: false, deadLetter: DEAD_LETTER_QUEUE },
  { name: QUEUES.MESSAGE_SEND, retryLimit: 4, retryDelay: 5, retryBackoff: true, deadLetter: DEAD_LETTER_QUEUE },
  { name: QUEUES.ECHO_RECONCILE, retryLimit: 3, retryDelay: 5, retryBackoff: false, deadLetter: DEAD_LETTER_QUEUE },
  { name: QUEUES.MEDIA_DOWNLOAD, retryLimit: 3, retryDelay: 10, retryBackoff: true, deadLetter: DEAD_LETTER_QUEUE },
  { name: QUEUES.AI_TRANSCRIBE, retryLimit: 2, retryDelay: 10, retryBackoff: true, deadLetter: DEAD_LETTER_QUEUE },
  // `stately`: at most one queued and one active job per singletonKey (= conversationId), AI-7.
  // The handler never throws on provider failure (AI-14); the single retry only covers a crashed worker.
  { name: QUEUES.AI_TURN, policy: "stately", retryLimit: 1, retryDelay: 30, retryBackoff: false, deadLetter: DEAD_LETTER_QUEUE },
  { name: QUEUES.KB_INGEST, retryLimit: 2, retryDelay: 30, retryBackoff: true, deadLetter: DEAD_LETTER_QUEUE },
  { name: QUEUES.NOTIFY_EMAIL, retryLimit: 3, retryDelay: 30, retryBackoff: true, deadLetter: DEAD_LETTER_QUEUE },
  { name: QUEUES.RETENTION_PURGE, retryLimit: 2, retryDelay: 300, retryBackoff: true, deadLetter: DEAD_LETTER_QUEUE },
  { name: QUEUES.AFFILIATION_DRAFT_MATERIALIZE, retryLimit: 3, retryDelay: 30, retryBackoff: true, deadLetter: DEAD_LETTER_QUEUE },
]

/**
 * Per-send defaults the topology implies but pg-boss only accepts on `send()`.
 * Producers spread these into their `boss.send` options, adding the singletonKey
 * where the policy needs one (event id for `wa.event.process`, conversation id for `ai.turn`).
 */
export const QUEUE_SEND_DEFAULTS: Partial<Record<QueueName, SendOptions>> = {
  [QUEUES.ECHO_RECONCILE]: { startAfter: 5 },
  [QUEUES.AI_TURN]: { startAfter: 8 },
}

/** Create (or reconcile) the dead-letter queue first, then every queue that points at it. */
export async function ensureQueues(boss: {
  createQueue: (name: string, options?: Omit<Queue, "name">) => Promise<void>
  updateQueue: (
    name: string,
    options?: { retryLimit?: number; retryDelay?: number; retryBackoff?: boolean; deadLetter?: string | null }
  ) => Promise<void>
}): Promise<void> {
  await boss.createQueue(DEAD_LETTER_QUEUE)

  for (const { name, policy, ...options } of QUEUE_DEFINITIONS) {
    await boss.createQueue(name, { ...(policy ? { policy } : {}), ...options })
    // createQueue is a no-op for existing queues; updateQueue keeps retry settings in sync with this file.
    await boss.updateQueue(name, options)
  }
}
