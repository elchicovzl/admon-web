import { describe, it, expect, vi } from "vitest"

// Real boss/queues/schedules/workers modules; only the pg-boss constructor is observed.
const constructed = vi.fn()
vi.mock("pg-boss", () => ({
  PgBoss: class {
    constructor() {
      constructed()
    }
  },
}))

describe("bootstrapRuntime with WHATSAPP_ENABLED off (real modules)", () => {
  it.each([undefined, "", "false"])(
    "never constructs pg-boss for WHATSAPP_ENABLED=%j",
    async (value) => {
      vi.spyOn(console, "info").mockImplementation(() => {})
      const { bootstrapRuntime } = await import("../bootstrap")
      const env = { DIRECT_URL: "postgresql://localhost/db", WORKER_ENABLED: "true" } as unknown as NodeJS.ProcessEnv
      if (value !== undefined) env.WHATSAPP_ENABLED = value

      await bootstrapRuntime(env)

      expect(constructed).not.toHaveBeenCalled()
    }
  )

  it.each(["True", "yes", "1", "TRUE"])(
    "aborts startup for the invalid WHATSAPP_ENABLED=%j without touching pg-boss",
    async (value) => {
      vi.spyOn(console, "info").mockImplementation(() => {})
      const { bootstrapRuntime } = await import("../bootstrap")
      const env = {
        DIRECT_URL: "postgresql://localhost/db",
        WHATSAPP_ENABLED: value,
      } as unknown as NodeJS.ProcessEnv

      await expect(bootstrapRuntime(env)).rejects.toThrow(/WHATSAPP_ENABLED/)
      expect(constructed).not.toHaveBeenCalled()
    }
  )
})
