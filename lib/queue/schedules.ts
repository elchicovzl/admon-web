import { QUEUES, type QueueName } from "./queues"

export interface ScheduleDefinition {
  queue: QueueName
  cron: string
  tz: string
}

/** Recurring jobs (design D2). */
export const SCHEDULE_DEFINITIONS: readonly ScheduleDefinition[] = [
  { queue: QUEUES.EVENT_SWEEP, cron: "* * * * *", tz: "UTC" },
  { queue: QUEUES.RETENTION_PURGE, cron: "0 3 * * *", tz: "America/Bogota" },
]

export async function ensureSchedules(boss: {
  schedule: (name: string, cron: string, data?: object | null, options?: { tz?: string }) => Promise<void>
}): Promise<void> {
  for (const { queue, cron, tz } of SCHEDULE_DEFINITIONS) {
    await boss.schedule(queue, cron, null, { tz })
  }
}
