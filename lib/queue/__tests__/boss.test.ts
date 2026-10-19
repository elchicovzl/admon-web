import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const instances: MockBoss[] = []

let startError: Error | undefined

class MockBoss {
  options: Record<string, unknown>
  start = vi.fn(async () => {
    if (startError) throw startError
    return this
  })
  stop = vi.fn(async () => {})
  on = vi.fn()
  constructor(options: Record<string, unknown>) {
    this.options = options
    instances.push(this)
  }
}

vi.mock("pg-boss", () => ({ PgBoss: MockBoss }))

const DB_URL = "postgresql://user:pass@localhost:55432/admon"

async function load() {
  vi.resetModules()
  return import("../boss")
}

let sigtermBefore: NodeJS.SignalsListener[] = []

function resetGlobals() {
  const g = globalThis as Record<string, unknown>
  delete g.__boss
  delete g.__bossStarting
  delete g.__bossShutdownRegistered
}

describe("pg-boss lifecycle", () => {
  beforeEach(() => {
    instances.length = 0
    startError = undefined
    sigtermBefore = process.listeners("SIGTERM")
    resetGlobals()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    resetGlobals()
    // Drop listeners registered by the code under test so they never fire in later tests.
    for (const listener of process.listeners("SIGTERM")) {
      if (!sigtermBefore.includes(listener)) process.removeListener("SIGTERM", listener)
    }
  })

  it("starts a server instance in the pgboss schema with a pool of 4", async () => {
    const { startBoss } = await load()

    await startBoss(DB_URL)

    expect(instances).toHaveLength(1)
    expect(instances[0].options).toMatchObject({
      connectionString: DB_URL,
      schema: "pgboss",
      max: 4,
    })
    expect(instances[0].options).not.toHaveProperty("schedule", false)
    expect(instances[0].start).toHaveBeenCalledOnce()
  })

  it("is idempotent: concurrent and repeated calls share one instance", async () => {
    const { startBoss } = await load()

    const [a, b] = await Promise.all([startBoss(DB_URL), startBoss(DB_URL)])
    const c = await startBoss(DB_URL)

    expect(a).toBe(b)
    expect(a).toBe(c)
    expect(instances).toHaveLength(1)
  })

  it("registers an error listener so pg-boss errors cannot crash the process", async () => {
    const { startBoss } = await load()

    await startBoss(DB_URL)

    expect(instances[0].on).toHaveBeenCalledWith("error", expect.any(Function))
  })

  it("clears the in-flight start when it fails so a later call can retry", async () => {
    const { startBoss } = await load()
    startError = new Error("connection refused")

    await expect(startBoss(DB_URL)).rejects.toThrow("connection refused")

    startError = undefined
    await expect(startBoss(DB_URL)).resolves.toBeDefined()
    expect(instances).toHaveLength(2)
  })

  it("getBoss reuses the running instance", async () => {
    const { startBoss, getBoss } = await load()
    const started = await startBoss(DB_URL)

    expect(await getBoss()).toBe(started)
    expect(instances).toHaveLength(1)
  })

  it("getBoss lazily creates a send-only instance from the configured URL", async () => {
    vi.stubEnv("DIRECT_URL", DB_URL)
    const { getBoss } = await load()

    await getBoss()

    expect(instances).toHaveLength(1)
    expect(instances[0].options).toMatchObject({
      connectionString: DB_URL,
      schedule: false,
      supervise: false,
    })
  })

  it("getBoss fails clearly when no queue database is configured", async () => {
    vi.stubEnv("DIRECT_URL", "")
    vi.stubEnv("QUEUE_DATABASE_URL", "")
    const { getBoss } = await load()

    await expect(getBoss()).rejects.toThrow(/QUEUE_DATABASE_URL or DIRECT_URL/)
    expect(instances).toHaveLength(0)
  })

  it("stops gracefully with a 20 s timeout on SIGTERM", async () => {
    const { startBoss } = await load()
    // Simulates the Next.js handler so the code under test does not call process.exit.
    process.on("SIGTERM", () => {})

    await startBoss(DB_URL)
    process.emit("SIGTERM")
    await vi.waitFor(() => expect(instances[0].stop).toHaveBeenCalled())

    expect(instances[0].stop).toHaveBeenCalledWith({ graceful: true, timeout: 20_000 })
  })
})
