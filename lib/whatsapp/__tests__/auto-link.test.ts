import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  clientFindFirst: vi.fn(),
  contactFindMany: vi.fn(),
  contactUpdate: vi.fn(),
  leadUpdateMany: vi.fn(),
  conversationUpdateMany: vi.fn(),
  queryRaw: vi.fn(),
  transaction: vi.fn(),
}))
vi.mock("@/lib/db/prisma", () => ({
  default: {
    client: { findFirst: m.clientFindFirst },
    whatsAppContact: { findMany: m.contactFindMany, update: m.contactUpdate },
    lead: { updateMany: m.leadUpdateMany },
    conversation: { updateMany: m.conversationUpdateMany },
    $queryRaw: m.queryRaw,
    $transaction: m.transaction,
  },
}))
vi.mock("@/lib/notifications/port", () => ({ getNotifyPort: () => ({ notify: vi.fn() }) }))

import { autoLinkContactsForClient } from "../contacts"

const CLIENT = "client-1"
const contact = { id: "c1", waId: "573001234567", matchStatus: "UNMATCHED" }

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  m.clientFindFirst.mockResolvedValue({ id: CLIENT, phone: "+57 300 123 4567" })
  m.contactFindMany.mockResolvedValue([contact])
  m.queryRaw.mockResolvedValue([{ id: CLIENT }])
  m.contactUpdate.mockResolvedValue({})
  m.leadUpdateMany.mockResolvedValue({ count: 1 })
  m.conversationUpdateMany.mockResolvedValue({ count: 1 })
  m.transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops))
})

describe("autoLinkContactsForClient (LD-5, WC-9)", () => {
  it("looks only at unlocked, unlinked contacts whose wa_id is the client's phone", async () => {
    await autoLinkContactsForClient(CLIENT)

    expect(m.clientFindFirst).toHaveBeenCalledWith({
      where: { id: CLIENT, isActive: true, status: { not: "ELIMINADO" } },
      select: { id: true, phone: true },
    })
    expect(m.contactFindMany).toHaveBeenCalledWith({
      where: { waId: { in: ["573001234567"] }, matchLocked: false, clientId: null },
      select: { id: true, waId: true, matchStatus: true },
    })
  })

  it("also tries the Colombian code for a phone stored without it", async () => {
    m.clientFindFirst.mockResolvedValue({ id: CLIENT, phone: "300 123 4567" })

    await autoLinkContactsForClient(CLIENT)

    expect(m.contactFindMany.mock.calls[0][0].where.waId.in).toEqual(["3001234567", "573001234567"])
  })

  it("links a unique match as MATCHED, converts its lead and bumps the conversation", async () => {
    const r = await autoLinkContactsForClient(CLIENT)

    expect(m.contactUpdate).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { clientId: CLIENT, matchStatus: "MATCHED" },
    })
    expect(m.leadUpdateMany).toHaveBeenCalledWith({
      where: { contactId: "c1" },
      data: { status: "CONVERTED", convertedClientId: CLIENT },
    })
    expect(m.conversationUpdateMany).toHaveBeenCalledWith({
      where: { contactId: "c1" },
      data: { updatedAt: expect.any(Date) },
    })
    expect(r).toEqual({ linked: 1, ambiguous: 0 })
  })

  it("flags the contact AMBIGUOUS without linking when several clients share the number", async () => {
    m.queryRaw.mockResolvedValue([{ id: CLIENT }, { id: "client-2" }])

    const r = await autoLinkContactsForClient(CLIENT)

    expect(m.contactUpdate).toHaveBeenCalledWith({ where: { id: "c1" }, data: { matchStatus: "AMBIGUOUS" } })
    expect(m.leadUpdateMany).not.toHaveBeenCalled()
    expect(r).toEqual({ linked: 0, ambiguous: 1 })
  })

  it("does nothing for an inactive or deleted client, or one without a usable phone", async () => {
    m.clientFindFirst.mockResolvedValue(null)
    expect(await autoLinkContactsForClient(CLIENT)).toEqual({ linked: 0, ambiguous: 0 })

    m.clientFindFirst.mockResolvedValue({ id: CLIENT, phone: "123" })
    expect(await autoLinkContactsForClient(CLIENT)).toEqual({ linked: 0, ambiguous: 0 })
    expect(m.contactFindMany).not.toHaveBeenCalled()
  })

  it("swallows errors and keeps going with the other contacts", async () => {
    m.contactFindMany.mockResolvedValue([contact, { id: "c2", waId: "573001234567", matchStatus: "UNMATCHED" }])
    m.transaction.mockRejectedValueOnce(new Error("db down"))

    const r = await autoLinkContactsForClient(CLIENT)

    expect(r).toEqual({ linked: 1, ambiguous: 0 })
  })

  it("never throws, even when the client lookup fails", async () => {
    m.clientFindFirst.mockRejectedValue(new Error("db down"))

    await expect(autoLinkContactsForClient(CLIENT)).resolves.toEqual({ linked: 0, ambiguous: 0 })
  })
})
