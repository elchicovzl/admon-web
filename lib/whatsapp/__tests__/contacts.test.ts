import { Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  contactUpsert: vi.fn(),
  contactUpdate: vi.fn(),
  leadFindUnique: vi.fn(),
  leadCreate: vi.fn(),
  notify: vi.fn(),
}))
vi.mock("@/lib/db/prisma", () => ({
  default: {
    $queryRaw: m.queryRaw,
    whatsAppContact: { upsert: m.contactUpsert, update: m.contactUpdate },
    lead: { findUnique: m.leadFindUnique, create: m.leadCreate },
  },
}))
vi.mock("@/lib/notifications/port", () => ({ getNotifyPort: () => ({ notify: m.notify }) }))

import { confirmContactAsUnknown, ensureLead, upsertAndMatchContact } from "../contacts"

const SEEN = new Date("2026-10-19T12:00:00Z")
const baseContact = {
  id: "c1",
  waId: "573001234567",
  profileName: "Test User",
  clientId: null,
  matchStatus: "UNMATCHED",
  matchLocked: false,
}

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  m.contactUpsert.mockResolvedValue(baseContact)
  m.contactUpdate.mockImplementation(async ({ data }) => ({ ...baseContact, ...data }))
  m.queryRaw.mockResolvedValue([])
  m.leadFindUnique.mockResolvedValue(null)
  m.leadCreate.mockImplementation(async ({ data }) => ({ id: "l1", ...data }))
  m.notify.mockResolvedValue(undefined)
})

describe("upsertAndMatchContact", () => {
  it("links the contact when exactly one Client matches (MATCHED)", async () => {
    m.queryRaw.mockResolvedValue([{ id: "client-1" }])

    const contact = await upsertAndMatchContact({ waId: "573001234567", profileName: "Test User", seenAt: SEEN })

    expect(m.contactUpdate).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { clientId: "client-1", matchStatus: "MATCHED" },
    })
    expect(contact.matchStatus).toBe("MATCHED")
  })

  it("flags AMBIGUOUS and does not link when several Clients match (S-WC-11)", async () => {
    m.queryRaw.mockResolvedValue([{ id: "a" }, { id: "b" }])

    const contact = await upsertAndMatchContact({ waId: "573001234567", seenAt: SEEN })

    expect(contact.matchStatus).toBe("AMBIGUOUS")
    expect(m.contactUpdate.mock.calls[0][0].data).toEqual({ matchStatus: "AMBIGUOUS" })
  })

  it("leaves an unmatched contact untouched when nothing matches", async () => {
    const contact = await upsertAndMatchContact({ waId: "573001234567", seenAt: SEEN })

    expect(contact.matchStatus).toBe("UNMATCHED")
    expect(m.contactUpdate).not.toHaveBeenCalled()
  })

  it("never re-matches a contact that is already linked or manually locked", async () => {
    m.contactUpsert.mockResolvedValueOnce({ ...baseContact, clientId: "client-9", matchStatus: "MATCHED" })
    await upsertAndMatchContact({ waId: "573001234567", seenAt: SEEN })
    m.contactUpsert.mockResolvedValueOnce({ ...baseContact, matchLocked: true })
    await upsertAndMatchContact({ waId: "573001234567", seenAt: SEEN })

    expect(m.queryRaw).not.toHaveBeenCalled()
    expect(m.contactUpdate).not.toHaveBeenCalled()
  })

  it("passes full and national digit candidates to the SQL match", async () => {
    await upsertAndMatchContact({ waId: "573001234567", seenAt: SEEN })

    const query = m.queryRaw.mock.calls[0][0] as Prisma.Sql
    expect(query.values).toEqual(["573001234567", "3001234567"])
    expect(query.sql).toContain("ELIMINADO")
  })

  it("rejects ids that cannot be a phone number", async () => {
    await expect(upsertAndMatchContact({ waId: "12", seenAt: SEEN })).rejects.toThrow("Invalid WhatsApp id")
  })

  it("keeps the existing profile name when Meta sends none", async () => {
    await upsertAndMatchContact({ waId: "573001234567", profileName: "  ", seenAt: SEEN })

    expect(m.contactUpsert.mock.calls[0][0].update).toEqual({ lastSeenAt: SEEN })
  })
})

describe("ensureLead", () => {
  it("creates exactly one NEW lead from WHATSAPP with E.164 phone and profile name (LD-1, S-LD-1)", async () => {
    const { lead, created } = await ensureLead(baseContact, "conv-1")

    expect(created).toBe(true)
    expect(m.leadCreate.mock.calls[0][0].data).toEqual({
      contactId: "c1",
      source: "WHATSAPP",
      status: "NEW",
      phoneE164: "+573001234567",
      displayName: "Test User",
      conversationId: "conv-1",
    })
    expect(lead.id).toBe("l1")
  })

  it("notifies NEW_LEAD through the port once, on creation only (LD-6)", async () => {
    await ensureLead(baseContact, "conv-1")

    expect(m.notify).toHaveBeenCalledWith({
      type: "NEW_LEAD",
      leadId: "l1",
      contactId: "c1",
      conversationId: "conv-1",
    })
  })

  it("does not duplicate the lead on the second message (S-LD-2)", async () => {
    m.leadFindUnique.mockResolvedValue({ id: "l1" })

    const { created } = await ensureLead(baseContact, "conv-1")

    expect(created).toBe(false)
    expect(m.leadCreate).not.toHaveBeenCalled()
    expect(m.notify).not.toHaveBeenCalled()
  })

  it("re-reads the winner when a concurrent first message hits the unique constraint (S-LD-3)", async () => {
    m.leadFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "winner" })
    m.leadCreate.mockRejectedValue(p2002())

    const { lead, created } = await ensureLead(baseContact, "conv-1")

    expect(created).toBe(false)
    expect(lead.id).toBe("winner")
    expect(m.notify).not.toHaveBeenCalled()
  })

  it("rethrows errors that are not unique violations", async () => {
    m.leadCreate.mockRejectedValue(new Error("db down"))

    await expect(ensureLead(baseContact)).rejects.toThrow("db down")
  })

  it("keeps the lead when the notifier fails", async () => {
    m.notify.mockRejectedValue(new Error("notifier down"))

    const { created } = await ensureLead(baseContact)

    expect(created).toBe(true)
  })
})

describe("confirmContactAsUnknown", () => {
  it("locks the contact as UNMATCHED and creates the withheld lead (LD-8)", async () => {
    m.contactUpdate.mockResolvedValue({ ...baseContact, matchStatus: "UNMATCHED", matchLocked: true })

    const { created } = await confirmContactAsUnknown("c1", "conv-1")

    expect(m.contactUpdate).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { matchStatus: "UNMATCHED", matchLocked: true, clientId: null },
    })
    expect(created).toBe(true)
  })
})
