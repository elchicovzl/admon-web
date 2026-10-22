import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  contactFindUnique: vi.fn(),
  clientFindMany: vi.fn(),
  leadUpdate: vi.fn(),
  findClientsByWaId: vi.fn(),
  linkContactToClient: vi.fn(),
  ensureLead: vi.fn(),
}))
vi.mock("@/lib/db/prisma", () => ({
  default: {
    whatsAppContact: { findUnique: m.contactFindUnique },
    client: { findMany: m.clientFindMany },
    lead: { update: m.leadUpdate },
  },
}))
vi.mock("../contacts", () => ({
  findClientsByWaId: m.findClientsByWaId,
  linkContactToClient: m.linkContactToClient,
  ensureLead: m.ensureLead,
}))

import { applyIdentityDocument, documentNumbersMatch } from "../identity-document"

const NOW = new Date("2026-10-22T17:00:00Z")
const CEDULA = { documentType: "CEDULA", number: "1.033.657.664", fullName: "Miguel Alejandro Vizcaino", businessName: "" } as const
const RUT = { documentType: "NIT", number: "900.123.456-7", fullName: "", businessName: "Comercial Andes SAS" } as const

function contact(overrides: Record<string, unknown> = {}) {
  return {
    id: "contact-1",
    waId: "573244033035",
    profileName: "Miguel",
    clientId: null,
    matchStatus: "UNMATCHED",
    matchLocked: false,
    leadSuppressed: false,
    ...overrides,
  }
}

function lead(overrides: Record<string, unknown> = {}) {
  return { id: "lead-1", fullName: null, identificationType: null, identificationNumber: null, notes: null, ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
  m.contactFindUnique.mockResolvedValue(contact())
  m.ensureLead.mockResolvedValue({ lead: lead(), created: false })
  m.leadUpdate.mockResolvedValue({})
  m.linkContactToClient.mockResolvedValue({ ok: true })
})

describe("documentNumbersMatch", () => {
  it("ignores dots, spaces and dashes", () => {
    expect(documentNumbersMatch("1033657664", "1.033.657 664")).toBe(true)
  })

  it("matches a NIT with or without its check digit", () => {
    expect(documentNumbersMatch("900123456-7", "900.123.456-7")).toBe(true)
    expect(documentNumbersMatch("900123456-7", "900123456")).toBe(true)
  })

  it("does not match different numbers", () => {
    expect(documentNumbersMatch("1033657664", "1033657665")).toBe(false)
  })
})

describe("applyIdentityDocument: ambiguous contact", () => {
  beforeEach(() => {
    m.contactFindUnique.mockResolvedValue(contact({ matchStatus: "AMBIGUOUS" }))
    m.findClientsByWaId.mockResolvedValue(["client-a", "client-b", "client-c"])
  })

  it("links the contact to the only client with that phone and that cédula", async () => {
    m.clientFindMany.mockResolvedValue([
      { id: "client-a", identificationNumber: "52111222" },
      { id: "client-b", identificationNumber: "1033657664" },
      { id: "client-c", identificationNumber: "900123456-7" },
    ])

    expect(await applyIdentityDocument({ contactId: "contact-1", conversationId: "conv-1", document: CEDULA, now: NOW })).toEqual({
      status: "LINKED",
      clientId: "client-b",
    })
    expect(m.findClientsByWaId).toHaveBeenCalledWith("573244033035", expect.any(Number))
    expect(m.linkContactToClient).toHaveBeenCalledWith("contact-1", "client-b")
    expect(m.ensureLead).not.toHaveBeenCalled()
    expect(m.leadUpdate).not.toHaveBeenCalled()
  })

  it("links a company by the NIT on its RUT", async () => {
    m.clientFindMany.mockResolvedValue([
      { id: "client-a", identificationNumber: "52111222" },
      { id: "client-c", identificationNumber: "900123456-7" },
    ])

    expect(await applyIdentityDocument({ contactId: "contact-1", conversationId: "conv-1", document: RUT, now: NOW })).toEqual({
      status: "LINKED",
      clientId: "client-c",
    })
    expect(m.linkContactToClient).toHaveBeenCalledWith("contact-1", "client-c")
  })

  it("keeps it ambiguous and saves the data in a lead when no client has that number", async () => {
    m.clientFindMany.mockResolvedValue([
      { id: "client-a", identificationNumber: "52111222" },
      { id: "client-b", identificationNumber: "80999888" },
    ])

    expect(await applyIdentityDocument({ contactId: "contact-1", conversationId: "conv-1", document: CEDULA, now: NOW })).toEqual({
      status: "LEAD_UPDATED",
      leadId: "lead-1",
    })
    expect(m.linkContactToClient).not.toHaveBeenCalled()
    expect(m.ensureLead).toHaveBeenCalledWith(expect.objectContaining({ id: "contact-1" }), "conv-1")
    expect(m.leadUpdate).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      data: expect.objectContaining({ fullName: "Miguel Alejandro Vizcaino", identificationType: "CEDULA", identificationNumber: "1.033.657.664" }),
    })
  })

  it("does not pick one when several clients share the number", async () => {
    m.clientFindMany.mockResolvedValue([
      { id: "client-a", identificationNumber: "1033657664" },
      { id: "client-b", identificationNumber: "1.033.657.664" },
    ])

    const outcome = await applyIdentityDocument({ contactId: "contact-1", conversationId: "conv-1", document: CEDULA, now: NOW })

    expect(outcome.status).toBe("LEAD_UPDATED")
    expect(m.linkContactToClient).not.toHaveBeenCalled()
  })
})

describe("applyIdentityDocument: contact without a client", () => {
  it("fills only the empty lead fields and notes where the data came from", async () => {
    m.ensureLead.mockResolvedValue({ lead: lead({ fullName: "Miguel V. (corregido por asesor)" }), created: false })

    await applyIdentityDocument({ contactId: "contact-1", conversationId: "conv-1", document: CEDULA, now: NOW })

    const data = m.leadUpdate.mock.calls[0][0].data
    expect(data).not.toHaveProperty("fullName")
    expect(data).toMatchObject({ identificationType: "CEDULA", identificationNumber: "1.033.657.664" })
    expect(data.notes).toContain("Extraído por IA")
    expect(data.notes).toContain("verificar")
    expect(m.findClientsByWaId).not.toHaveBeenCalled()
  })

  it("stores a RUT's NIT and puts the business name in the notes", async () => {
    await applyIdentityDocument({ contactId: "contact-1", conversationId: "conv-1", document: RUT, now: NOW })

    const data = m.leadUpdate.mock.calls[0][0].data
    expect(data).toMatchObject({ fullName: "Comercial Andes SAS", identificationType: "NIT", identificationNumber: "900.123.456-7" })
    expect(data.notes).toContain("Comercial Andes SAS")
    expect(data.notes).toContain("RUT")
  })

  it("appends to existing notes and does not repeat the same line", async () => {
    await applyIdentityDocument({ contactId: "contact-1", conversationId: "conv-1", document: CEDULA, now: NOW })
    const firstNotes = m.leadUpdate.mock.calls[0][0].data.notes as string

    m.leadUpdate.mockClear()
    m.ensureLead.mockResolvedValue({
      lead: lead({ notes: `Llamar en la tarde\n${firstNotes}`, identificationType: "CEDULA", identificationNumber: "1.033.657.664", fullName: "Miguel Alejandro Vizcaino" }),
      created: false,
    })
    await applyIdentityDocument({ contactId: "contact-1", conversationId: "conv-1", document: CEDULA, now: NOW })

    expect(m.leadUpdate).not.toHaveBeenCalled()
  })

  it("writes the type together with the number, replacing a type left without a number", async () => {
    m.ensureLead.mockResolvedValue({ lead: lead({ identificationType: "CEDULA" }), created: false })

    await applyIdentityDocument({ contactId: "contact-1", conversationId: "conv-1", document: RUT, now: NOW })

    expect(m.leadUpdate.mock.calls[0][0].data).toMatchObject({ identificationType: "NIT", identificationNumber: "900.123.456-7" })
  })

  it("keeps notes a manager wrote before", async () => {
    m.ensureLead.mockResolvedValue({ lead: lead({ notes: "Llamar en la tarde" }), created: false })

    await applyIdentityDocument({ contactId: "contact-1", conversationId: "conv-1", document: CEDULA, now: NOW })

    expect(m.leadUpdate.mock.calls[0][0].data.notes).toMatch(/^Llamar en la tarde\nExtraído por IA/)
  })
})

describe("applyIdentityDocument: nothing to do", () => {
  it("leaves a contact already linked to a client alone", async () => {
    m.contactFindUnique.mockResolvedValue(contact({ clientId: "client-x", matchStatus: "MATCHED" }))

    expect(await applyIdentityDocument({ contactId: "contact-1", conversationId: "conv-1", document: CEDULA, now: NOW })).toEqual({
      status: "SKIPPED",
      reason: "ALREADY_LINKED",
    })
    expect(m.ensureLead).not.toHaveBeenCalled()
    expect(m.linkContactToClient).not.toHaveBeenCalled()
  })

  it("does not recreate a lead a manager removed on purpose", async () => {
    m.ensureLead.mockResolvedValue({ lead: null, created: false, suppressed: true })

    expect(await applyIdentityDocument({ contactId: "contact-1", conversationId: "conv-1", document: CEDULA, now: NOW })).toEqual({
      status: "SKIPPED",
      reason: "LEAD_SUPPRESSED",
    })
    expect(m.leadUpdate).not.toHaveBeenCalled()
  })

  it("ignores a number that cannot be a document", async () => {
    expect(
      await applyIdentityDocument({ contactId: "contact-1", conversationId: "conv-1", document: { ...CEDULA, number: "12" }, now: NOW })
    ).toEqual({ status: "SKIPPED", reason: "INVALID_NUMBER" })
    expect(m.contactFindUnique).not.toHaveBeenCalled()
  })

  it("does not auto-link a contact whose link a manager locked", async () => {
    m.contactFindUnique.mockResolvedValue(contact({ matchStatus: "AMBIGUOUS", matchLocked: true }))

    await applyIdentityDocument({ contactId: "contact-1", conversationId: "conv-1", document: CEDULA, now: NOW })

    expect(m.findClientsByWaId).not.toHaveBeenCalled()
    expect(m.linkContactToClient).not.toHaveBeenCalled()
  })
})
