import { beforeEach, describe, expect, it, vi } from "vitest"

const { updateMany, createMany, findMany } = vi.hoisted(() => ({
  updateMany: vi.fn(),
  createMany: vi.fn(),
  findMany: vi.fn(),
}))
vi.mock("@/lib/db/prisma", () => ({
  default: {
    whatsAppMessage: { updateMany },
    whatsAppStatusEvent: { createMany, findMany },
  },
}))

import {
  applyStatusToMessage,
  applyStoredStatuses,
  parseMetaStatus,
  recordAndApplyStatus,
  statusRank,
} from "../statuses"

const TS = new Date("2026-10-19T12:00:00Z")

beforeEach(() => {
  vi.clearAllMocks()
  updateMany.mockResolvedValue({ count: 1 })
  createMany.mockResolvedValue({ count: 1 })
})

describe("statusRank", () => {
  it("orders QUEUED < SENT < DELIVERED < READ and puts FAILED on top (terminal)", () => {
    expect(statusRank("QUEUED")).toBe(0)
    expect(statusRank("SENT")).toBeGreaterThan(statusRank("QUEUED"))
    expect(statusRank("DELIVERED")).toBeGreaterThan(statusRank("SENT"))
    expect(statusRank("READ")).toBeGreaterThan(statusRank("DELIVERED"))
    expect(statusRank("FAILED")).toBeGreaterThan(statusRank("READ"))
  })
})

describe("parseMetaStatus", () => {
  it("maps tracked statuses and ignores the rest", () => {
    expect(parseMetaStatus("sent")).toBe("SENT")
    expect(parseMetaStatus("DELIVERED")).toBe("DELIVERED")
    expect(parseMetaStatus("read")).toBe("READ")
    expect(parseMetaStatus("failed")).toBe("FAILED")
    expect(parseMetaStatus("deleted")).toBeNull()
  })
})

describe("applyStatusToMessage", () => {
  it("only updates rows with a lower rank, so a late delivered never overwrites read (S-WC-7)", async () => {
    await applyStatusToMessage({ wamid: "w1", status: "DELIVERED", timestamp: TS })

    expect(updateMany).toHaveBeenCalledWith({
      where: { wamid: "w1", statusRank: { lt: statusRank("DELIVERED") } },
      data: { status: "DELIVERED", statusRank: statusRank("DELIVERED") },
    })
  })

  it("stores the error code and title on failed (S-WC-8)", async () => {
    await applyStatusToMessage({
      wamid: "w1",
      status: "FAILED",
      timestamp: TS,
      errorCode: "131047",
      errorTitle: "Re-engagement message",
    })

    expect(updateMany.mock.calls[0][0].data).toMatchObject({
      status: "FAILED",
      errorCode: "131047",
      errorMessage: "Re-engagement message",
    })
  })

  it("records sentAt when the message is sent", async () => {
    await applyStatusToMessage({ wamid: "w1", status: "SENT", timestamp: TS })

    expect(updateMany.mock.calls[0][0].data.sentAt).toEqual(TS)
  })

  it("is a harmless no-op when the message does not exist yet", async () => {
    updateMany.mockResolvedValue({ count: 0 })

    await expect(applyStatusToMessage({ wamid: "w1", status: "READ", timestamp: TS })).resolves.toBe(0)
  })
})

describe("recordAndApplyStatus", () => {
  it("stores the status event with skipDuplicates and then applies it", async () => {
    await recordAndApplyStatus({ wamid: "w1", status: "READ", timestamp: TS })

    expect(createMany.mock.calls[0][0].skipDuplicates).toBe(true)
    expect(createMany.mock.calls[0][0].data[0]).toMatchObject({ wamid: "w1", status: "READ" })
    expect(updateMany).toHaveBeenCalledTimes(1)
  })

  it("keeps a status stored even when no message matches, to be applied later", async () => {
    updateMany.mockResolvedValue({ count: 0 })

    await recordAndApplyStatus({ wamid: "early", status: "DELIVERED", timestamp: TS })

    expect(createMany).toHaveBeenCalledTimes(1)
  })
})

describe("applyStoredStatuses", () => {
  it("applies the highest stored status once the message has its wamid", async () => {
    findMany.mockResolvedValue([
      { status: "SENT", errorCode: null, errorTitle: null, timestamp: TS },
      { status: "READ", errorCode: null, errorTitle: null, timestamp: TS },
      { status: "DELIVERED", errorCode: null, errorTitle: null, timestamp: TS },
    ])

    await applyStoredStatuses("w1")

    expect(updateMany).toHaveBeenCalledTimes(1)
    expect(updateMany.mock.calls[0][0].data.status).toBe("READ")
  })

  it("does nothing when no status was stored", async () => {
    findMany.mockResolvedValue([])

    await applyStoredStatuses("w1")

    expect(updateMany).not.toHaveBeenCalled()
  })
})
