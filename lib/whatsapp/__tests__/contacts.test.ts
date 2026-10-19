import { Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  contactUpsert: vi.fn(),
  contactUpdate: vi.fn(),
  leadFindUnique: vi.fn(),
  leadCreate: vi.fn(),
  contactFindMany: vi.fn(),
  leadDeleteMany: vi.fn(),
  transaction: vi.fn(),
  notify: vi.fn(),
}))
vi.mock("@/lib/db/prisma", () => ({
  default: {
    $queryRaw: m.queryRaw,
    whatsAppContact: { upsert: m.contactUpsert, update: m.contactUpdate, findMany: m.contactFindMany },
    lead: { findUnique: m.leadFindUnique, create: m.leadCreate, deleteMany: m.leadDeleteMany },
    $transaction: m.transaction,
  },
}))
vi.mock("@/lib/notifications/port", () => ({ getNotifyPort: () => ({ notify: m.notify }) }))

import {
  LEAD_RECOVERY_COOLDOWN_MS,
  LEAD_RECOVERY_MAX_ATTEMPTS,
  confirmContactAsUnknown,
  ensureLead,
  recoverMissingLeads,
  removeLead,
  upsertAndMatchContact,
} from "../contacts"

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
  m.leadDeleteMany.mockResolvedValue({ count: 1 })
  m.transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops))
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
    expect(lead?.id).toBe("l1")
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
    expect(lead?.id).toBe("winner")
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
      data: { matchStatus: "UNMATCHED", matchLocked: true, clientId: null, leadSuppressed: false },
    })
    expect(created).toBe(true)
  })
})

describe("deliberately removed leads", () => {
  it("removeLead deletes the lead and suppresses re-creation in one transaction", async () => {
    await removeLead("c1")

    expect(m.leadDeleteMany).toHaveBeenCalledWith({ where: { contactId: "c1" } })
    expect(m.contactUpdate).toHaveBeenCalledWith({ where: { id: "c1" }, data: { leadSuppressed: true } })
    expect(m.transaction).toHaveBeenCalledTimes(1)
  })

  it("ensureLead does not recreate the lead of a suppressed contact (inbound path)", async () => {
    const result = await ensureLead({ ...baseContact, leadSuppressed: true }, "conv-1")

    expect(result).toEqual({ lead: null, created: false, suppressed: true })
    expect(m.leadFindUnique).not.toHaveBeenCalled()
    expect(m.leadCreate).not.toHaveBeenCalled()
    expect(m.notify).not.toHaveBeenCalled()
  })
})

describe("recoverMissingLeads", () => {
  const NOW = new Date("2026-10-19T12:00:00Z")
  const orphan = {
    id: "c1",
    waId: "573001234567",
    profileName: "Test User",
    leadSuppressed: false,
    conversation: { id: "conv-1" },
  }

  it("creates the lead for an UNMATCHED contact whose lead step failed earlier", async () => {
    m.contactFindMany.mockResolvedValue([orphan])

    const created = await recoverMissingLeads(50, NOW)

    expect(m.leadCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ contactId: "c1", status: "NEW", conversationId: "conv-1" }),
    })
    expect(created).toBe(1)
  })

  it("only selects eligible contacts: unsuppressed, no lead row, under the attempt cap, past the cooldown", async () => {
    m.contactFindMany.mockResolvedValue([])

    await recoverMissingLeads(50, NOW)

    expect(m.contactFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          matchStatus: "UNMATCHED",
          leadSuppressed: false,
          lead: null, // a DISCARDED lead still has its row, so it is never "missing"
          conversation: { isNot: null },
          leadRecoveryAttempts: { lt: LEAD_RECOVERY_MAX_ATTEMPTS },
          OR: [{ leadRecoveryAt: null }, { leadRecoveryAt: { lt: new Date(NOW.getTime() - LEAD_RECOVERY_COOLDOWN_MS) } }],
        },
        orderBy: [{ leadRecoveryAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
        take: 50,
      })
    )
  })

  it("keeps going after one failure and records the failed attempt for backoff", async () => {
    m.contactFindMany.mockResolvedValue([orphan, { ...orphan, id: "c2", conversation: { id: "conv-2" } }])
    m.leadCreate.mockRejectedValueOnce(new Error("db down"))
    m.contactUpdate.mockResolvedValue({ leadRecoveryAttempts: 1 })

    const created = await recoverMissingLeads(50, NOW)

    expect(m.leadCreate).toHaveBeenCalledTimes(2)
    expect(created).toBe(1)
    expect(m.contactUpdate).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { leadRecoveryAttempts: { increment: 1 }, leadRecoveryAt: NOW },
      select: { leadRecoveryAttempts: true },
    })
  })

  it("does nothing when no contact is missing its lead", async () => {
    m.contactFindMany.mockResolvedValue([])

    await expect(recoverMissingLeads()).resolves.toBe(0)
    expect(m.leadCreate).not.toHaveBeenCalled()
  })

  describe("saturation (permanently failing contacts must not starve the batch)", () => {
    interface FakeContact {
      id: string
      createdAt: number
      leadRecoveryAttempts: number
      leadRecoveryAt: Date | null
      lead: boolean
      failing: boolean
    }

    /** Evaluates the exact `where`/`orderBy`/`take` recoverMissingLeads sends, over an in-memory table. */
    function installTable(table: FakeContact[]) {
      m.contactFindMany.mockImplementation(async (args: any) => {
        const cutoff: Date = args.where.OR[1].leadRecoveryAt.lt
        return table
          .filter(
            (c) =>
              !c.lead &&
              c.leadRecoveryAttempts < args.where.leadRecoveryAttempts.lt &&
              (c.leadRecoveryAt === null || c.leadRecoveryAt < cutoff)
          )
          .sort((a, b) => {
            const at = a.leadRecoveryAt?.getTime() ?? -Infinity
            const bt = b.leadRecoveryAt?.getTime() ?? -Infinity
            return at - bt || a.createdAt - b.createdAt
          })
          .slice(0, args.take)
          .map((c) => ({ id: c.id, waId: "573001234567", profileName: null, leadSuppressed: false, conversation: { id: `conv-${c.id}` } }))
      })
      m.leadCreate.mockImplementation(async ({ data }: any) => {
        const contact = table.find((c) => c.id === data.contactId)!
        if (contact.failing) throw new Error("permanent failure")
        contact.lead = true
        return { id: `lead-${contact.id}`, ...data }
      })
      m.contactUpdate.mockImplementation(async ({ where, data }: any) => {
        const contact = table.find((c) => c.id === where.id)!
        contact.leadRecoveryAttempts += data.leadRecoveryAttempts.increment
        contact.leadRecoveryAt = data.leadRecoveryAt
        return { leadRecoveryAttempts: contact.leadRecoveryAttempts }
      })
    }

    function build(failing: number): FakeContact[] {
      const table: FakeContact[] = Array.from({ length: failing }, (_, i) => ({
        id: `bad-${i}`,
        createdAt: i,
        leadRecoveryAttempts: 0,
        leadRecoveryAt: null,
        lead: false,
        failing: true,
      }))
      // The healthy contact is the NEWEST: with a plain "50 oldest" query it would never be reached.
      table.push({ id: "good", createdAt: failing + 1, leadRecoveryAttempts: 0, leadRecoveryAt: null, lead: false, failing: false })
      return table
    }

    it("reaches a healthy contact queued behind more failing ones than the batch size", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {})
      const table = build(120) // 120 failing contacts, batch of 50
      installTable(table)

      let sweeps = 0
      while (!table.find((c) => c.id === "good")!.lead && sweeps < 10) {
        await recoverMissingLeads(50, new Date(NOW.getTime() + sweeps * 60_000))
        sweeps++
      }

      expect(table.find((c) => c.id === "good")!.lead).toBe(true)
      expect(sweeps).toBeLessThanOrEqual(3) // 50 + 50 + (20 failing + good)
    })

    it("stops retrying a permanently failing contact after the attempt cap", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {})
      const table = build(3)
      installTable(table)

      // One sweep per cooldown period, far more than the cap.
      for (let i = 0; i < LEAD_RECOVERY_MAX_ATTEMPTS + 3; i++) {
        await recoverMissingLeads(50, new Date(NOW.getTime() + i * (LEAD_RECOVERY_COOLDOWN_MS + 1)))
      }

      const bad = table.filter((c) => c.failing)
      expect(bad.every((c) => c.leadRecoveryAttempts === LEAD_RECOVERY_MAX_ATTEMPTS)).toBe(true)
      expect(m.leadCreate.mock.calls.filter(([arg]) => arg.data.contactId === "bad-0")).toHaveLength(
        LEAD_RECOVERY_MAX_ATTEMPTS
      )
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("gave up on contact bad-0"))
    })

    it("waits for the cooldown before retrying a failed contact", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {})
      const table = build(1)
      installTable(table)

      await recoverMissingLeads(50, NOW)
      m.leadCreate.mockClear()
      await recoverMissingLeads(50, new Date(NOW.getTime() + 60_000)) // inside the cooldown

      expect(m.leadCreate.mock.calls.filter(([arg]) => arg.data.contactId === "bad-0")).toHaveLength(0)
    })
  })
})
