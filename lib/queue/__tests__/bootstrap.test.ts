import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const boss = { name: "boss" }
const startBoss = vi.fn(async () => boss)
const ensureQueues = vi.fn(async () => {})
const ensureSchedules = vi.fn(async () => {})
const startWorkers = vi.fn(async () => 0)

const registerWhatsAppWorkers = vi.fn()
vi.mock("@/lib/whatsapp/event-worker", () => ({ registerWhatsAppWorkers }))
vi.mock("../boss", () => ({ startBoss }))
vi.mock("../queues", () => ({ ensureQueues }))
vi.mock("../schedules", () => ({ ensureSchedules }))
vi.mock("../workers", () => ({ startWorkers }))

const META_ENV = {
  WHATSAPP_APP_SECRET: "s",
  WHATSAPP_VERIFY_TOKEN: "v",
  WHATSAPP_ACCESS_TOKEN: "t",
  WHATSAPP_PHONE_NUMBER_ID: "1",
  WHATSAPP_WABA_ID: "2",
  WHATSAPP_GRAPH_VERSION: "v25.0",
}

function env(vars: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { DIRECT_URL: "postgresql://localhost/db", ...vars } as unknown as NodeJS.ProcessEnv
}

describe("bootstrapRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "info").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => vi.restoreAllMocks())

  async function run(vars?: Record<string, string>) {
    const { bootstrapRuntime } = await import("../bootstrap")
    return bootstrapRuntime(env(vars))
  }

  it("aborts startup (throws) when WHATSAPP_ENABLED=true and Meta vars are missing", async () => {
    await expect(run({ WHATSAPP_ENABLED: "true" })).rejects.toThrow(/WHATSAPP_APP_SECRET/)
    expect(startBoss).not.toHaveBeenCalled()
  })

  it("starts queues, schedules and workers in order when enabled", async () => {
    await run({ WHATSAPP_ENABLED: "true", ...META_ENV })

    expect(startBoss).toHaveBeenCalledWith("postgresql://localhost/db")
    expect(ensureQueues).toHaveBeenCalledWith(boss)
    expect(ensureSchedules).toHaveBeenCalledWith(boss)
    expect(startWorkers).toHaveBeenCalledWith(boss)
    expect(ensureQueues.mock.invocationCallOrder[0]).toBeLessThan(
      startWorkers.mock.invocationCallOrder[0]
    )
  })

  it("is a strict no-op with the flag unset: nothing started, no validation", async () => {
    await run()

    expect(startBoss).not.toHaveBeenCalled()
    expect(ensureQueues).not.toHaveBeenCalled()
    expect(ensureSchedules).not.toHaveBeenCalled()
    expect(startWorkers).not.toHaveBeenCalled()
    expect(console.info).toHaveBeenCalledOnce()
  })

  it("is a strict no-op with WHATSAPP_ENABLED=false, even with invalid other vars", async () => {
    await expect(
      run({ WHATSAPP_ENABLED: "false", AI_DEBOUNCE_SECONDS: "not-a-number" })
    ).resolves.toBeUndefined()

    expect(startBoss).not.toHaveBeenCalled()
  })

  it("skips queue startup when WORKER_ENABLED=false", async () => {
    await run({ WHATSAPP_ENABLED: "true", ...META_ENV, WORKER_ENABLED: "false" })

    expect(startBoss).not.toHaveBeenCalled()
  })

  it("prefers QUEUE_DATABASE_URL over DIRECT_URL", async () => {
    await run({ WHATSAPP_ENABLED: "true", ...META_ENV, QUEUE_DATABASE_URL: "postgresql://localhost/queue" })

    expect(startBoss).toHaveBeenCalledWith("postgresql://localhost/queue")
  })

  it("aborts startup on queue failure when WhatsApp is enabled", async () => {
    startBoss.mockRejectedValueOnce(new Error("db down"))

    await expect(run({ WHATSAPP_ENABLED: "true", ...META_ENV })).rejects.toThrow("db down")
  })

  it("never logs the database URL", async () => {
    startBoss.mockRejectedValueOnce(new Error("db down"))

    await run({
      WHATSAPP_ENABLED: "true",
      ...META_ENV,
      DIRECT_URL: "postgresql://user:hunter2@localhost/db",
    }).catch(() => {})

    const logged = JSON.stringify(vi.mocked(console.error).mock.calls)
    expect(logged).not.toContain("hunter2")
  })
})
