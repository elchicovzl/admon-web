import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ findUnique: vi.fn(), updateMany: vi.fn(), eventCreate: vi.fn() }))
const tx = {
  conversation: { findUnique: m.findUnique, updateMany: m.updateMany },
  conversationEvent: { create: m.eventCreate },
}
vi.mock("@/lib/db/prisma", () => ({
  default: { $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx) },
}))

import { applyTransitionPort, defaultApplyTransition, setApplyTransitionPort } from "../transition-port"

const request = { conversationId: "conv-1", event: "HUMAN_ECHO", actor: "PHONE_APP", reason: "echo:w1" } as const

beforeEach(() => {
  vi.clearAllMocks()
  setApplyTransitionPort()
  m.updateMany.mockResolvedValue({ count: 1 })
})

describe("default HUMAN_ECHO transition", () => {
  it.each(["AI", "ESCALATED"])("moves %s to HUMAN with a version bump and an audit row (CH-8)", async (status) => {
    m.findUnique.mockResolvedValue({ status })

    await expect(defaultApplyTransition(request)).resolves.toBe(true)

    expect(m.updateMany).toHaveBeenCalledWith({
      where: { id: "conv-1", status },
      data: { status: "HUMAN", stateVersion: { increment: 1 } },
    })
    expect(m.eventCreate).toHaveBeenCalledWith({
      data: {
        conversationId: "conv-1",
        fromStatus: status,
        toStatus: "HUMAN",
        event: "HUMAN_ECHO",
        actor: "PHONE_APP",
        reason: "echo:w1",
      },
    })
  })

  it.each(["HUMAN", "CLOSED"])("leaves a %s conversation alone", async (status) => {
    m.findUnique.mockResolvedValue({ status })

    await expect(defaultApplyTransition(request)).resolves.toBe(false)

    expect(m.updateMany).not.toHaveBeenCalled()
    expect(m.eventCreate).not.toHaveBeenCalled()
  })

  it("loses cleanly to a concurrent transition", async () => {
    m.findUnique.mockResolvedValue({ status: "AI" })
    m.updateMany.mockResolvedValue({ count: 0 })

    await expect(defaultApplyTransition(request)).resolves.toBe(false)

    expect(m.eventCreate).not.toHaveBeenCalled()
  })
})

describe("port", () => {
  it("lets PR2.1 swap the implementation", async () => {
    const custom = vi.fn().mockResolvedValue(true)
    setApplyTransitionPort(custom)

    await expect(applyTransitionPort(request)).resolves.toBe(true)

    expect(custom).toHaveBeenCalledWith(request)
    expect(m.findUnique).not.toHaveBeenCalled()
  })
})
