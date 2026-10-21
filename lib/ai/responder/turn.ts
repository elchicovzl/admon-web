import { generateText, hasToolCall, isStepCount, type FilePart, type ImagePart, type ModelMessage, type TextPart } from "ai"
import type { MessageType } from "@prisma/client"
import prisma from "@/lib/db/prisma"
import { chatModel } from "@/lib/ai/providers"
import { getAiConfig } from "@/lib/config/runtime-config"
import { retrieveKnowledge } from "@/lib/knowledge/retrieve"
import { getObjectBytes } from "@/lib/storage/r2"
import { isBusinessHours, nextBusinessSlot } from "@/lib/whatsapp/business-hours"
import { isAiGloballyEnabled } from "@/lib/whatsapp/transitions"
import { commitAiEscalation, commitAiReply, type TurnSnapshot } from "./commit"
import { siteUrlFrom } from "./consent"
import { decideDebounce } from "./debounce"
import { EscalationReason, detectEscalation, nextFailureState } from "./escalation"
import { guardModelOutput, type TerminalReply } from "./guard"
import { buildHistory, type HistoryMessage } from "./history"
import { MEDIA_POLICY_LIMITS, classifyMedia } from "./media-policy"
import { PROMPT_VERSION, buildSystemPrompt, buildTurnContext, type TurnContext } from "./prompt"
import { AI_FAILURE_HOLDING_TEXT, TRANSCRIPTION_FAILED_TEXT, UNSUPPORTED_MEDIA_TEXT, handoffText } from "./texts"
import { buildResponderTools, toolResultForModel } from "./tools"
import { recordChatTurnUsage, setUsageOutcome, type ChatTurnUsage } from "./usage"

/**
 * One AI turn (`ai.turn`, AI-1..AI-16): answers every client message since `aiCursorAt`.
 *
 * Order: kill switches → pending batch → staleness → debounce → deterministic checks (request for
 * a person, forbidden topic, daily limit, unreadable attachments) → the model with the knowledge
 * search → output guard → commit under a row lock (commit.ts). Nothing is written before the
 * commit, except the usage record and moving the cursor past a stale batch.
 *
 * Model call: `claude-opus-5-5` / `claude-sonnet-5-5` reject forced tool choice and `temperature`
 * (HTTP 400), so tools are strict with `toolChoice: 'auto'`; the prompt requires ending with
 * `sendReply` or `escalateToHuman`, and the loop stops on either. A provider failure never throws:
 * it records the failure, escalates (AI_FAILURE) and sends one neutral holding message.
 */

export interface TurnJob {
  conversationId: string
  /** Times this batch was discarded because the client kept writing. */
  discards?: number
}

export type TurnOutcome =
  | { status: "SKIPPED"; reason: "AI_OFF" | "NOT_AI" | "NOTHING_PENDING" | "STALE" }
  | { status: "WAIT"; delaySeconds: number }
  | { status: "REPLIED" }
  | { status: "ESCALATED" }
  | { status: "DISCARDED"; reason: string }
  | { status: "FAILED" }

/** After this many discards caused by new client messages, the turn answers anyway. */
const MAX_DISCARDS = 2
const PENDING_LIMIT = 50
const HISTORY_FETCH = 30
const MAX_OUTPUT_TOKENS = 600
const DAY_MS = 24 * 60 * 60 * 1000

const pendingSelect = {
  id: true,
  type: true,
  text: true,
  timestamp: true,
  media: {
    select: { status: true, mimeType: true, sizeBytes: true, durationSec: true, transcript: true, transcriptStatus: true, s3Key: true },
  },
} as const

interface PendingMedia {
  status: string
  mimeType: string
  sizeBytes: number | null
  durationSec: number | null
  transcript: string | null
  transcriptStatus: string | null
  s3Key: string | null
}

interface PendingMessage {
  id: string
  type: MessageType
  text: string | null
  timestamp: Date
  media: PendingMedia | null
}

/** Still downloading, or a voice note still being transcribed. */
function isMediaPending(message: PendingMessage): boolean {
  const media = message.media
  if (!media) return false
  if (media.status === "PENDING") return true
  return message.type === "AUDIO" && media.status === "STORED" && (media.transcriptStatus === null || media.transcriptStatus === "PENDING")
}

type UserPart = TextPart | ImagePart | FilePart

/** Turns the pending batch into the user message parts the model reads (MH-5). */
async function buildUserParts(pending: PendingMessage[]): Promise<{ parts: UserPart[]; text: string; transcriptFailed: boolean }> {
  const parts: UserPart[] = []
  let transcriptFailed = false
  const caption = (message: PendingMessage) => message.text?.trim() || null

  for (const message of pending) {
    if (message.type === "TEXT") {
      if (caption(message)) parts.push({ type: "text", text: caption(message)! })
      continue
    }
    if (message.type === "AUDIO") {
      if (message.media?.transcriptStatus === "DONE" && message.media.transcript?.trim()) {
        parts.push({ type: "text", text: `[Nota de voz] ${message.media.transcript.trim()}` })
      } else {
        transcriptFailed = true
      }
      continue
    }
    const media = message.media
    const decision = media
      ? classifyMedia({ mimeType: media.mimeType, sizeBytes: media.sizeBytes, durationSec: media.durationSec, messageType: message.type })
      : "UNSUPPORTED"
    const label = message.type === "IMAGE" ? "[Imagen]" : message.type === "DOCUMENT" ? "[Documento]" : null
    if (media?.status === "STORED" && media.s3Key && (decision === "VISION_IMAGE" || decision === "VISION_PDF")) {
      try {
        const limit = decision === "VISION_IMAGE" ? MEDIA_POLICY_LIMITS.imageBytes : MEDIA_POLICY_LIMITS.pdfBytes
        const bytes = await getObjectBytes(media.s3Key, limit)
        parts.push({ type: "text", text: caption(message) ? `${label} ${caption(message)}` : label! })
        parts.push(
          decision === "VISION_IMAGE"
            ? { type: "image", image: bytes, mediaType: media.mimeType }
            : { type: "file", data: bytes, mediaType: "application/pdf" }
        )
        continue
      } catch {
        console.error(`[ai] could not read attachment of message ${message.id}`)
      }
    }
    // Not readable: a caption still counts as text the client wrote.
    if (caption(message) && label) parts.push({ type: "text", text: `${label} ${caption(message)}` })
  }

  const text = parts.filter((part): part is TextPart => part.type === "text").map((part) => part.text).join("\n")
  return { parts, text, transcriptFailed }
}

export async function runAiTurn(job: TurnJob, deps: { now?: () => Date } = {}): Promise<TurnOutcome> {
  const now = (deps.now ?? (() => new Date()))()
  const config = getAiConfig()
  const globalAi = await isAiGloballyEnabled()
  if (!globalAi) return { status: "SKIPPED", reason: "AI_OFF" }

  const conversation = await prisma.conversation.findUnique({
    where: { id: job.conversationId },
    select: {
      id: true,
      status: true,
      stateVersion: true,
      aiPaused: true,
      aiCursorAt: true,
      consecutiveAiFailures: true,
      contact: { select: { profileName: true, client: { select: { fullName: true } }, lead: { select: { status: true } } } },
    },
  })
  if (!conversation || conversation.status !== "AI" || conversation.aiPaused) return { status: "SKIPPED", reason: "NOT_AI" }

  const pending: PendingMessage[] = await prisma.whatsAppMessage.findMany({
    where: {
      conversationId: conversation.id,
      direction: "IN",
      ...(conversation.aiCursorAt ? { timestamp: { gt: conversation.aiCursorAt } } : {}),
    },
    orderBy: [{ timestamp: "asc" }, { id: "asc" }],
    take: PENDING_LIMIT,
    select: pendingSelect,
  })
  if (pending.length === 0) return { status: "SKIPPED", reason: "NOTHING_PENDING" }
  const oldest = pending[0].timestamp
  const newest = pending[pending.length - 1].timestamp

  // Never answer a stale batch (a backlog after an outage would read as nonsense, threat: stale replay).
  if (now.getTime() - newest.getTime() > config.maxReplyAgeMinutes * 60 * 1000) {
    await prisma.conversation.updateMany({
      where: { id: conversation.id, OR: [{ aiCursorAt: null }, { aiCursorAt: { lt: newest } }] },
      data: { aiCursorAt: newest },
    })
    return { status: "SKIPPED", reason: "STALE" }
  }

  const debounce = decideDebounce(
    { now, lastInboundAt: newest, oldestPendingAt: oldest, mediaPending: pending.some(isMediaPending) },
    { debounceSeconds: config.debounceSeconds, debounceMaxSeconds: config.debounceMaxSeconds }
  )
  if (debounce.action === "WAIT") return { status: "WAIT", delaySeconds: debounce.delaySeconds }

  const snapshot: TurnSnapshot = { conversationId: conversation.id, stateVersion: conversation.stateVersion, newestPendingAt: newest }
  const siteUrl = siteUrlFrom()
  const inHours = isBusinessHours(now)
  const nextSlot = inHours ? null : nextBusinessSlot(now)

  const escalate = async (reason: EscalationReason, usageRecordId: string | null, text = handoffText({ isBusinessHours: inHours, nextBusinessSlot: nextSlot })) => {
    const result = await commitAiEscalation({
      snapshot,
      reason,
      outOfHours: !inHours,
      attentionDueAt: inHours ? now : nextSlot!,
      text,
      usageRecordId,
      globalAi,
      siteUrl,
      now,
    })
    return result
  }
  const reply = (text: string, sourceChunkIds: string[], usageRecordId: string | null, consecutiveFailures: number) =>
    commitAiReply({
      snapshot,
      text,
      sourceChunkIds,
      usageRecordId,
      consecutiveFailures,
      globalAi,
      ignoreNewerInbound: (job.discards ?? 0) >= MAX_DISCARDS,
      siteUrl,
      now,
    })
  const toOutcome = (result: { status: string; reason?: string }, ok: "REPLIED" | "ESCALATED"): TurnOutcome =>
    result.status === "DISCARDED" ? { status: "DISCARDED", reason: result.reason ?? "UNKNOWN" } : { status: ok }

  const { parts, text, transcriptFailed } = await buildUserParts(pending)

  // Deterministic checks first: no model call is needed to hand over or to refuse a topic.
  const requested = detectEscalation(text, config.forbiddenTopics)
  if (requested) return toOutcome(await escalate(requested, null), "ESCALATED")

  const aiRepliesToday = await prisma.whatsAppMessage.count({
    where: { conversationId: conversation.id, direction: "OUT", source: "AI", timestamp: { gte: new Date(now.getTime() - DAY_MS) } },
  })
  if (aiRepliesToday >= config.maxTurnsPerDay) return toOutcome(await escalate(EscalationReason.TURN_LIMIT, null), "ESCALATED")

  // Nothing the model can read (stickers, video, a voice note that failed): answer without it (S-MH-2/4/5).
  if (parts.length === 0) {
    const failures = conversation.consecutiveAiFailures + 1
    const next = nextFailureState(failures, config.maxConsecutiveFailures, true)
    if (next.escalate) return toOutcome(await escalate(next.reason, null), "ESCALATED")
    return toOutcome(await reply(transcriptFailed ? TRANSCRIPTION_FAILED_TEXT : UNSUPPORTED_MEDIA_TEXT, [], null, failures), "REPLIED")
  }

  const history: HistoryMessage[] = (
    await prisma.whatsAppMessage.findMany({
      where: { conversationId: conversation.id, timestamp: { lt: oldest } },
      orderBy: [{ timestamp: "desc" }, { id: "desc" }],
      take: HISTORY_FETCH,
      select: { direction: true, source: true, type: true, text: true, timestamp: true, media: { select: { transcript: true } } },
    })
  ).map((row) => ({ ...row, transcript: row.media?.transcript ?? null }))

  const contact = conversation.contact
  const context: TurnContext = {
    firstName: (contact.client?.fullName ?? contact.profileName ?? "").split(/\s+/)[0] || null,
    contactKind: contact.client ? "CLIENT" : contact.lead ? "LEAD" : "UNKNOWN",
    now,
    isBusinessHours: inHours,
    nextBusinessSlot: nextSlot,
  }

  const allowedSourceIds = new Set<string>()
  const retrievalScores: ChatTurnUsage["retrievalScores"] = []
  let topSimilarity: number | null = null
  const tools = buildResponderTools({
    searchKnowledge: async (query) => {
      const result = await retrieveKnowledge(query)
      if (result.status === "OK") {
        topSimilarity = Math.max(topSimilarity ?? 0, result.topSimilarity)
        for (const chunk of result.chunks) {
          allowedSourceIds.add(chunk.id)
          retrievalScores.push({ id: chunk.id, similarity: chunk.similarity, rrfScore: chunk.rrfScore })
        }
      } else if ("topSimilarity" in result && result.topSimilarity !== null) {
        topSimilarity = Math.max(topSimilarity ?? 0, result.topSimilarity)
      }
      return toolResultForModel(result)
    },
  })
  const messages: ModelMessage[] = [...buildHistory(history), { role: "user", content: parts }]
  const usageBase = { conversationId: conversation.id, model: config.chatModel ?? "unknown", promptVersion: PROMPT_VERSION }
  const startedAt = Date.now()

  const result = await generateText({
    model: chatModel(config),
    system: `${buildSystemPrompt()}\n\n${buildTurnContext(context)}`,
    messages,
    tools,
    toolChoice: "auto",
    stopWhen: [isStepCount(config.maxSteps), hasToolCall("sendReply"), hasToolCall("escalateToHuman")],
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    maxRetries: 2,
    providerOptions: { anthropic: { effort: "medium" } },
  })
    // Never log the error object: provider errors can echo the conversation.
    .catch(() => null)
  if (!result) {
    console.error(`[ai] model call failed for conversation ${conversation.id}`)
    const usageRecordId = await recordChatTurnUsage({
      ...usageBase,
      outcome: "FAILED",
      steps: 0,
      inputTokens: 0,
      outputTokens: 0,
      toolCalls: [],
      retrievalScores,
      retrievedChunkIds: [...allowedSourceIds],
      topSimilarity,
      latencyMs: Date.now() - startedAt,
      error: "PROVIDER_ERROR",
    })
    await escalate(EscalationReason.AI_FAILURE, usageRecordId, AI_FAILURE_HOLDING_TEXT)
    return { status: "FAILED" }
  }

  const calls = result.steps.flatMap((step) => step.toolCalls ?? [])
  const terminal = [...calls].reverse().find((call) => call.toolName === "sendReply" || call.toolName === "escalateToHuman")
  const usageRecordId = await recordChatTurnUsage({
    ...usageBase,
    outcome: terminal?.toolName === "escalateToHuman" ? "ESCALATED" : "REPLIED",
    steps: result.steps.length,
    inputTokens: result.totalUsage?.inputTokens ?? 0,
    outputTokens: result.totalUsage?.outputTokens ?? 0,
    toolCalls: calls.map((call) => ({ name: call.toolName })),
    retrievalScores,
    retrievedChunkIds: [...allowedSourceIds],
    topSimilarity,
    latencyMs: Date.now() - startedAt,
  })

  let outcome: TurnOutcome
  if (terminal?.toolName === "escalateToHuman") {
    const input = terminal.input as { reason: EscalationReason }
    outcome = toOutcome(await escalate(input.reason, usageRecordId), "ESCALATED")
  } else {
    const decision = guardModelOutput((terminal?.input as TerminalReply | undefined) ?? null, allowedSourceIds)
    if (decision.kind === "SEND") {
      outcome = toOutcome(await reply(decision.text, decision.sourceIds, usageRecordId, 0), "REPLIED")
    } else {
      const failures = conversation.consecutiveAiFailures + 1
      const next = nextFailureState(failures, config.maxConsecutiveFailures, false)
      outcome = next.escalate
        ? toOutcome(await escalate(next.reason, usageRecordId), "ESCALATED")
        : toOutcome(await reply(decision.text, [], usageRecordId, failures), "REPLIED")
    }
  }
  await setUsageOutcome(usageRecordId, outcome.status === "DISCARDED" ? "DISCARDED" : outcome.status === "ESCALATED" ? "ESCALATED" : "REPLIED")
  return outcome
}
