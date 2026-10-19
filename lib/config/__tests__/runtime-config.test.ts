import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  validateRuntimeConfig,
  loadRuntimeConfig,
  getRuntimeConfig,
  getWhatsAppConfig,
  getAiConfig,
  resetRuntimeConfigCache,
} from "../runtime-config"

const META_ENV = {
  WHATSAPP_APP_SECRET: "app-secret-value",
  WHATSAPP_VERIFY_TOKEN: "verify-token-value",
  WHATSAPP_ACCESS_TOKEN: "access-token-value",
  WHATSAPP_PHONE_NUMBER_ID: "1352461227955884",
  WHATSAPP_WABA_ID: "877851298749286",
  WHATSAPP_GRAPH_VERSION: "v25.0",
}

const AI_ENV = {
  ANTHROPIC_API_KEY: "anthropic-key-value",
  OPENAI_API_KEY: "openai-key-value",
  AI_CHAT_MODEL: "claude-sonnet",
}

function env(vars: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...vars } as NodeJS.ProcessEnv
}

describe("runtime config", () => {
  beforeEach(() => {
    resetRuntimeConfigCache()
  })

  describe("flags (XC-2)", () => {
    it("defaults every flag to false with an empty environment", () => {
      const config = validateRuntimeConfig(env())
      expect(config.whatsapp.enabled).toBe(false)
      expect(config.ai.enabled).toBe(false)
      expect(config.ai.draftsEnabled).toBe(false)
    })

    it("rejects flag values other than true/false", () => {
      expect(() =>
        validateRuntimeConfig(env({ WHATSAPP_ENABLED: "yes" }))
      ).toThrow(/WHATSAPP_ENABLED/)
    })

    it("treats empty strings as unset", () => {
      const config = validateRuntimeConfig(
        env({ WHATSAPP_ENABLED: "", AI_DEBOUNCE_SECONDS: "  " })
      )
      expect(config.whatsapp.enabled).toBe(false)
      expect(config.ai.debounceSeconds).toBe(8)
    })
  })

  describe("secrets / config threat row (WC-14)", () => {
    it("passes when WhatsApp is disabled even with no Meta variables", () => {
      expect(() => validateRuntimeConfig(env())).not.toThrow()
    })

    it("fails with ONE aggregated error naming every missing Meta variable", () => {
      let message = ""
      try {
        validateRuntimeConfig(env({ WHATSAPP_ENABLED: "true" }))
      } catch (error) {
        message = (error as Error).message
      }
      for (const name of [
        "WHATSAPP_APP_SECRET",
        "WHATSAPP_VERIFY_TOKEN",
        "WHATSAPP_ACCESS_TOKEN",
        "WHATSAPP_PHONE_NUMBER_ID",
        "WHATSAPP_WABA_ID",
        "WHATSAPP_GRAPH_VERSION",
      ]) {
        expect(message).toContain(name)
      }
      expect(message).toContain("WHATSAPP_ENABLED=true")
    })

    it("passes when enabled with all Meta variables", () => {
      const config = validateRuntimeConfig(
        env({ WHATSAPP_ENABLED: "true", ...META_ENV })
      )
      expect(config.whatsapp.enabled).toBe(true)
      expect(config.whatsapp.graphVersion).toBe("v25.0")
    })

    it("does not require AI keys when only WhatsApp is enabled", () => {
      expect(() =>
        validateRuntimeConfig(env({ WHATSAPP_ENABLED: "true", ...META_ENV }))
      ).not.toThrow()
    })

    it("requires AI keys and model only when WHATSAPP_AI_ENABLED=true", () => {
      let message = ""
      try {
        validateRuntimeConfig(env({ WHATSAPP_AI_ENABLED: "true" }))
      } catch (error) {
        message = (error as Error).message
      }
      expect(message).not.toBe("")
      for (const name of ["ANTHROPIC_API_KEY", "AI_CHAT_MODEL", "OPENAI_API_KEY"]) {
        expect(message).toContain(name)
      }

      const config = validateRuntimeConfig(
        env({ WHATSAPP_AI_ENABLED: "true", ...AI_ENV })
      )
      expect(config.ai.enabled).toBe(true)
      expect(config.ai.chatModel).toBe("claude-sonnet")
    })

    it("never includes secret values in the error message", () => {
      let message = ""
      try {
        validateRuntimeConfig(
          env({
            WHATSAPP_ENABLED: "true",
            WHATSAPP_APP_SECRET: "super-secret-value",
            AI_DEBOUNCE_SECONDS: "not-a-number",
          })
        )
      } catch (error) {
        message = (error as Error).message
      }
      expect(message).not.toContain("super-secret-value")
      expect(message).toContain("AI_DEBOUNCE_SECONDS")
    })

    it("rejects a debounce max lower than the quiet window", () => {
      expect(() =>
        validateRuntimeConfig(
          env({ AI_DEBOUNCE_SECONDS: "20", AI_DEBOUNCE_MAX_SECONDS: "10" })
        )
      ).toThrow(/AI_DEBOUNCE_MAX_SECONDS/)
    })
  })

  describe("defaults from the design table", () => {
    it("applies the documented defaults", () => {
      const { whatsapp, ai, worker } = validateRuntimeConfig(env())
      expect(whatsapp.retentionDays).toBe(365)
      expect(whatsapp.webhookEventRetentionDays).toBe(30)
      expect(whatsapp.mediaMaxBytes).toBe(26_214_400)
      expect(whatsapp.honorHolidays).toBe(false)
      expect(whatsapp.templates.language).toBe("es")
      expect(whatsapp.templates.approved).toEqual([])
      expect(ai.debounceSeconds).toBe(8)
      expect(ai.debounceMaxSeconds).toBe(30)
      expect(ai.minSimilarity).toBe(0.35)
      expect(ai.maxSteps).toBe(4)
      expect(ai.maxTurnsPerDay).toBe(30)
      expect(ai.maxConsecutiveFailures).toBe(2)
      expect(ai.maxReplyAgeMinutes).toBe(15)
      expect(ai.embeddingModel).toBe("text-embedding-3-small")
      expect(ai.embeddingDimensions).toBe(1536)
      expect(ai.sttModel).toBe("gpt-4o-mini-transcribe")
      expect(ai.sttMaxSeconds).toBe(600)
      expect(ai.kbUploadMaxBytes).toBe(15_728_640)
      expect(ai.forbiddenTopics).toEqual([])
      expect(worker.enabled).toBe(true)
    })

    it("parses CSV and pipe lists and numeric overrides", () => {
      const { whatsapp, ai } = validateRuntimeConfig(
        env({
          WHATSAPP_APPROVED_TEMPLATES: "RESUME, PROCESS_UPDATE",
          AI_FORBIDDEN_TOPICS: "legal | médico",
          WHATSAPP_RETENTION_DAYS: "90",
        })
      )
      expect(whatsapp.templates.approved).toEqual(["RESUME", "PROCESS_UPDATE"])
      expect(ai.forbiddenTopics).toEqual(["legal", "médico"])
      expect(whatsapp.retentionDays).toBe(90)
    })

    it("disables the worker only with WORKER_ENABLED=false", () => {
      expect(validateRuntimeConfig(env({ WORKER_ENABLED: "false" })).worker.enabled).toBe(false)
      expect(validateRuntimeConfig(env({ WORKER_ENABLED: "true" })).worker.enabled).toBe(true)
    })

    it("prefers QUEUE_DATABASE_URL over DIRECT_URL for the queue", () => {
      expect(
        validateRuntimeConfig(env({ DIRECT_URL: "postgresql://direct" })).worker.databaseUrl
      ).toBe("postgresql://direct")
      expect(
        validateRuntimeConfig(
          env({ DIRECT_URL: "postgresql://direct", QUEUE_DATABASE_URL: "postgresql://queue" })
        ).worker.databaseUrl
      ).toBe("postgresql://queue")
    })
  })

  describe("no import-time validation (S-WC-10)", () => {
    it("importing the module does not read or validate the environment", async () => {
      vi.resetModules()
      const original = process.env.WHATSAPP_ENABLED
      process.env.WHATSAPP_ENABLED = "true" // would fail validation: Meta vars missing
      try {
        await expect(import("../runtime-config")).resolves.toBeDefined()
      } finally {
        if (original === undefined) delete process.env.WHATSAPP_ENABLED
        else process.env.WHATSAPP_ENABLED = original
      }
    })
  })

  describe("cached accessors", () => {
    it("loadRuntimeConfig caches and accessors return the cached config", () => {
      const loaded = loadRuntimeConfig(
        env({ WHATSAPP_ENABLED: "true", ...META_ENV, WHATSAPP_AI_ENABLED: "true", ...AI_ENV })
      )
      expect(getRuntimeConfig()).toBe(loaded)
      expect(getWhatsAppConfig()).toBe(loaded.whatsapp)
      expect(getAiConfig()).toBe(loaded.ai)
    })

    it("validates lazily from process.env on first access when nothing is cached", () => {
      vi.stubEnv("WHATSAPP_ENABLED", "")
      vi.stubEnv("DEBOUNCE_PROBE", "x")
      try {
        expect(getWhatsAppConfig().enabled).toBe(false)
      } finally {
        vi.unstubAllEnvs()
      }
    })
  })
})
