/**
 * How the channel layer asks for an AI turn without importing the AI module (same pattern as the
 * audio port in media.ts). `registerAiTurnWorkers` plugs the real scheduler (`ai.turn`, PR3.6b);
 * without it, scheduling is a no-op and conversations simply wait for staff.
 */
export type AiTurnScheduler = (conversationId: string) => Promise<void>

let scheduler: AiTurnScheduler | undefined

export function setAiTurnScheduler(next?: AiTurnScheduler): void {
  scheduler = next
}

export async function scheduleAiTurnFor(conversationId: string): Promise<void> {
  await scheduler?.(conversationId)
}
