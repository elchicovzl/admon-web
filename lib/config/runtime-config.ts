import { z } from "zod"

/**
 * Runtime configuration for the WhatsApp / AI module.
 *
 * Validation is NEVER performed at import time (and therefore never during
 * `next build`, which runs without secrets). It runs:
 *  - at server start, from `instrumentation.ts` (fail fast, WC-14), and
 *  - lazily on the first accessor call outside the server (scripts, tests).
 */

/** Empty strings are treated as "unset" so `FOO=` in an env file behaves like a missing var. */
function cleanEnv(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(env)) {
    const trimmed = value?.trim()
    out[key] = trimmed ? trimmed : undefined
  }
  return out
}

const flag = z
  .enum(["true", "false"], { message: 'must be "true" or "false"' })
  .optional()
  .transform((value) => value === "true")

const positiveInt = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback)

const csv = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  )

const pipeList = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? "")
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean)
  )

const optionalString = z.string().optional()

const envSchema = z.object({
  // Feature flags (XC-2): everything is off unless explicitly enabled.
  WHATSAPP_ENABLED: flag,
  WHATSAPP_AI_ENABLED: flag,
  WHATSAPP_AI_DRAFTS_ENABLED: flag,

  // Meta credentials: required when WHATSAPP_ENABLED=true.
  WHATSAPP_APP_SECRET: optionalString,
  WHATSAPP_VERIFY_TOKEN: optionalString,
  WHATSAPP_ACCESS_TOKEN: optionalString,
  WHATSAPP_PHONE_NUMBER_ID: optionalString,
  WHATSAPP_WABA_ID: optionalString,
  WHATSAPP_GRAPH_VERSION: optionalString,

  // Templates: names are only known after Meta approves them (OPS-G4), so they stay optional.
  WHATSAPP_TEMPLATE_RESUME: optionalString,
  WHATSAPP_TEMPLATE_PROCESS_UPDATE: optionalString,
  WHATSAPP_TEMPLATE_LANG: z.string().default("es"),
  WHATSAPP_APPROVED_TEMPLATES: csv,

  // AI providers: required when WHATSAPP_AI_ENABLED=true.
  ANTHROPIC_API_KEY: optionalString,
  AI_CHAT_MODEL: optionalString,
  OPENAI_API_KEY: optionalString,
  AI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  AI_EMBEDDING_DIMENSIONS: positiveInt(1536),
  AI_STT_MODEL: z.string().default("gpt-4o-mini-transcribe"),

  // AI behaviour tuning.
  AI_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.35),
  AI_DEBOUNCE_SECONDS: positiveInt(8),
  AI_DEBOUNCE_MAX_SECONDS: positiveInt(30),
  AI_MAX_STEPS: positiveInt(4),
  AI_MAX_TURNS_PER_DAY: positiveInt(30),
  AI_MAX_CONSECUTIVE_FAILURES: positiveInt(2),
  AI_MAX_REPLY_AGE_MINUTES: positiveInt(15),
  AI_FORBIDDEN_TOPICS: pipeList,

  // Limits.
  WHATSAPP_MEDIA_MAX_BYTES: positiveInt(26_214_400),
  AI_STT_MAX_SECONDS: positiveInt(600),
  KB_UPLOAD_MAX_BYTES: positiveInt(15_728_640),

  // Retention and business-hours behaviour.
  WHATSAPP_RETENTION_DAYS: positiveInt(365),
  WHATSAPP_WEBHOOK_EVENT_RETENTION_DAYS: positiveInt(30),
  WHATSAPP_HONOR_HOLIDAYS: flag,

  // Queue / worker.
  WORKER_ENABLED: z
    .enum(["true", "false"], { message: 'must be "true" or "false"' })
    .optional()
    .transform((value) => value !== "false"),
  QUEUE_DATABASE_URL: optionalString,
  DIRECT_URL: optionalString,
})

type ParsedEnv = z.infer<typeof envSchema>

const META_REQUIRED = [
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_WABA_ID",
  "WHATSAPP_GRAPH_VERSION",
] as const satisfies readonly (keyof ParsedEnv)[]

const AI_REQUIRED = [
  "ANTHROPIC_API_KEY",
  "AI_CHAT_MODEL",
  "OPENAI_API_KEY",
] as const satisfies readonly (keyof ParsedEnv)[]

const conditionalSchema = envSchema.superRefine((env, ctx) => {
  if (env.WHATSAPP_ENABLED) {
    for (const key of META_REQUIRED) {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "is required when WHATSAPP_ENABLED=true",
        })
      }
    }
  }
  if (env.WHATSAPP_AI_ENABLED) {
    for (const key of AI_REQUIRED) {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "is required when WHATSAPP_AI_ENABLED=true",
        })
      }
    }
  }
  if (env.AI_DEBOUNCE_MAX_SECONDS < env.AI_DEBOUNCE_SECONDS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["AI_DEBOUNCE_MAX_SECONDS"],
      message: "must be greater than or equal to AI_DEBOUNCE_SECONDS",
    })
  }
})

export interface WhatsAppConfig {
  enabled: boolean
  /** Meta credentials. Present (validated) whenever `enabled` is true. */
  appSecret?: string
  verifyToken?: string
  accessToken?: string
  phoneNumberId?: string
  wabaId?: string
  graphVersion?: string
  templates: {
    resume?: string
    processUpdate?: string
    language: string
    approved: string[]
  }
  mediaMaxBytes: number
  retentionDays: number
  webhookEventRetentionDays: number
  honorHolidays: boolean
}

export interface AiConfig {
  enabled: boolean
  draftsEnabled: boolean
  /** Provider credentials. Present (validated) whenever `enabled` is true. */
  anthropicApiKey?: string
  openaiApiKey?: string
  chatModel?: string
  embeddingModel: string
  embeddingDimensions: number
  sttModel: string
  sttMaxSeconds: number
  minSimilarity: number
  debounceSeconds: number
  debounceMaxSeconds: number
  maxSteps: number
  maxTurnsPerDay: number
  maxConsecutiveFailures: number
  maxReplyAgeMinutes: number
  forbiddenTopics: string[]
  kbUploadMaxBytes: number
}

export interface WorkerConfig {
  enabled: boolean
  /** Connection string used by pg-boss (QUEUE_DATABASE_URL, falling back to DIRECT_URL). */
  databaseUrl?: string
}

export interface RuntimeConfig {
  whatsapp: WhatsAppConfig
  ai: AiConfig
  worker: WorkerConfig
}

function buildConfig(env: ParsedEnv): RuntimeConfig {
  return {
    whatsapp: {
      enabled: env.WHATSAPP_ENABLED,
      appSecret: env.WHATSAPP_APP_SECRET,
      verifyToken: env.WHATSAPP_VERIFY_TOKEN,
      accessToken: env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
      wabaId: env.WHATSAPP_WABA_ID,
      graphVersion: env.WHATSAPP_GRAPH_VERSION,
      templates: {
        resume: env.WHATSAPP_TEMPLATE_RESUME,
        processUpdate: env.WHATSAPP_TEMPLATE_PROCESS_UPDATE,
        language: env.WHATSAPP_TEMPLATE_LANG,
        approved: env.WHATSAPP_APPROVED_TEMPLATES,
      },
      mediaMaxBytes: env.WHATSAPP_MEDIA_MAX_BYTES,
      retentionDays: env.WHATSAPP_RETENTION_DAYS,
      webhookEventRetentionDays: env.WHATSAPP_WEBHOOK_EVENT_RETENTION_DAYS,
      honorHolidays: env.WHATSAPP_HONOR_HOLIDAYS,
    },
    ai: {
      enabled: env.WHATSAPP_AI_ENABLED,
      draftsEnabled: env.WHATSAPP_AI_DRAFTS_ENABLED,
      anthropicApiKey: env.ANTHROPIC_API_KEY,
      openaiApiKey: env.OPENAI_API_KEY,
      chatModel: env.AI_CHAT_MODEL,
      embeddingModel: env.AI_EMBEDDING_MODEL,
      embeddingDimensions: env.AI_EMBEDDING_DIMENSIONS,
      sttModel: env.AI_STT_MODEL,
      sttMaxSeconds: env.AI_STT_MAX_SECONDS,
      minSimilarity: env.AI_MIN_SIMILARITY,
      debounceSeconds: env.AI_DEBOUNCE_SECONDS,
      debounceMaxSeconds: env.AI_DEBOUNCE_MAX_SECONDS,
      maxSteps: env.AI_MAX_STEPS,
      maxTurnsPerDay: env.AI_MAX_TURNS_PER_DAY,
      maxConsecutiveFailures: env.AI_MAX_CONSECUTIVE_FAILURES,
      maxReplyAgeMinutes: env.AI_MAX_REPLY_AGE_MINUTES,
      forbiddenTopics: env.AI_FORBIDDEN_TOPICS,
      kbUploadMaxBytes: env.KB_UPLOAD_MAX_BYTES,
    },
    worker: {
      enabled: env.WORKER_ENABLED,
      databaseUrl: env.QUEUE_DATABASE_URL ?? env.DIRECT_URL,
    },
  }
}

/**
 * Parses and validates the environment. Throws ONE aggregated error naming every
 * problem (variable names only, never values, so secrets cannot leak into logs).
 */
export function validateRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): RuntimeConfig {
  const result = conditionalSchema.safeParse(cleanEnv(env))
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  - ${issue.path.join(".") || "(env)"}: ${issue.message}`
    )
    throw new Error(
      `Invalid WhatsApp runtime configuration:\n${lines.join("\n")}`
    )
  }
  return buildConfig(result.data)
}

let cached: RuntimeConfig | undefined

/** Validates (once) and caches the config. `validateRuntimeConfig()` + cache for the server boot. */
export function loadRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): RuntimeConfig {
  cached = validateRuntimeConfig(env)
  return cached
}

export function getRuntimeConfig(): RuntimeConfig {
  cached ??= validateRuntimeConfig()
  return cached
}

export function getWhatsAppConfig(): WhatsAppConfig {
  return getRuntimeConfig().whatsapp
}

export function getAiConfig(): AiConfig {
  return getRuntimeConfig().ai
}

/** Test helper: forget the cached config. */
export function resetRuntimeConfigCache(): void {
  cached = undefined
}
