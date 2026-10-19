import type { Job, PgBoss, WorkOptions } from "pg-boss"
import type { QueueName } from "./queues"

/**
 * Worker registry. Feature modules register their handlers here (one per queue);
 * `startWorkers` attaches them to pg-boss once the queues exist. PR0.2 ships the
 * registry only: no handlers are registered yet.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JobHandler<T = any> = (jobs: Job<T>[]) => Promise<unknown>

export interface WorkerRegistration<T = unknown> {
  queue: QueueName
  handler: JobHandler<T>
  options?: WorkOptions
}

const registry = new Map<QueueName, WorkerRegistration>()

export function registerWorker<T = unknown>(registration: WorkerRegistration<T>): void {
  if (registry.has(registration.queue)) {
    throw new Error(`A worker is already registered for queue "${registration.queue}"`)
  }
  registry.set(registration.queue, registration as WorkerRegistration)
}

export function getRegisteredWorkers(): WorkerRegistration[] {
  return [...registry.values()]
}

/** Test helper. */
export function clearWorkerRegistry(): void {
  registry.clear()
}

export async function startWorkers(boss: Pick<PgBoss, "work">): Promise<number> {
  const workers = getRegisteredWorkers()
  for (const { queue, handler, options } of workers) {
    if (options) await boss.work(queue, options, handler)
    else await boss.work(queue, handler)
  }
  return workers.length
}
