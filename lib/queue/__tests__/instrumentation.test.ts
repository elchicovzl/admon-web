import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const bootstrapRuntime = vi.fn(async () => {})
vi.mock("../bootstrap", () => ({ bootstrapRuntime }))

describe("instrumentation register()", () => {
  beforeEach(() => {
    bootstrapRuntime.mockClear()
  })

  afterEach(() => vi.unstubAllEnvs())

  async function register() {
    const mod = await import("../../../instrumentation")
    return mod.register()
  }

  it("bootstraps on the nodejs runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs")
    vi.stubEnv("NEXT_PHASE", "phase-production-server")

    await register()

    expect(bootstrapRuntime).toHaveBeenCalledOnce()
  })

  it("does nothing on the edge runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge")

    await register()

    expect(bootstrapRuntime).not.toHaveBeenCalled()
  })

  it("does nothing during next build (no secrets available)", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs")
    vi.stubEnv("NEXT_PHASE", "phase-production-build")

    await register()

    expect(bootstrapRuntime).not.toHaveBeenCalled()
  })

  it("propagates a config error so server start aborts", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs")
    bootstrapRuntime.mockRejectedValueOnce(new Error("Invalid WhatsApp runtime configuration"))

    await expect(register()).rejects.toThrow("Invalid WhatsApp runtime configuration")
  })
})
