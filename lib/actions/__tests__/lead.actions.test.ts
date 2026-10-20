import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '@prisma/client'

const { prismaMock, authMock, hasWhatsAppAccessMock, contactsMock } = vi.hoisted(() => ({
  prismaMock: {
    lead: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    conversation: { updateMany: vi.fn() },
  },
  authMock: vi.fn(),
  hasWhatsAppAccessMock: vi.fn(),
  contactsMock: { linkContactToClient: vi.fn(), removeLead: vi.fn() },
}))

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/auth/auth', () => ({ auth: authMock }))
vi.mock('@/lib/auth/rbac', () => ({ hasWhatsAppAccess: hasWhatsAppAccessMock }))
vi.mock('@/lib/whatsapp/contacts', () => contactsMock)

import { convertLead, deleteLead, listLeads, setLeadStatus, updateLead } from '../lead.actions'

const LEAD = 'cjld2cjxh0000qzrmn831i7rn'
const CLIENT = 'cjld2cjxh0001qzrmn831i7rn'

function leadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: LEAD,
    contactId: 'contact-1',
    status: 'NEW',
    source: 'WHATSAPP',
    phoneE164: '+573001234567',
    displayName: 'Test User',
    fullName: null,
    identificationType: null,
    identificationNumber: null,
    email: null,
    notes: null,
    conversationId: 'conv-1',
    convertedClient: null,
    createdAt: new Date('2026-10-20T10:00:00Z'),
    updatedAt: new Date('2026-10-20T10:00:00Z'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  authMock.mockResolvedValue({ user: { id: 'u1', role: UserRole.MANAGER } })
  hasWhatsAppAccessMock.mockResolvedValue(true)
  prismaMock.lead.findMany.mockResolvedValue([leadRow()])
  prismaMock.lead.findUnique.mockResolvedValue(leadRow())
  prismaMock.lead.update.mockImplementation(async ({ data }) => leadRow(data))
  prismaMock.conversation.updateMany.mockResolvedValue({ count: 1 })
  contactsMock.linkContactToClient.mockResolvedValue({ ok: true })
  contactsMock.removeLead.mockResolvedValue(undefined)
})

const actions = {
  listLeads: () => listLeads({}),
  updateLead: () => updateLead({ leadId: LEAD, notes: 'Llamar el lunes' }),
  setLeadStatus: () => setLeadStatus({ leadId: LEAD, status: 'CONTACTED' }),
  convertLead: () => convertLead({ leadId: LEAD, clientId: CLIENT }),
  deleteLead: () => deleteLead({ leadId: LEAD }),
}

describe('lead actions: authorization (LD-3)', () => {
  for (const [name, run] of Object.entries(actions)) {
    it(`${name} denies a MANAGER without WhatsApp access and touches nothing`, async () => {
      hasWhatsAppAccessMock.mockResolvedValue(false)

      expect(await run()).toEqual({ success: false, error: 'No tienes acceso al módulo de WhatsApp' })
      expect(prismaMock.lead.findMany).not.toHaveBeenCalled()
      expect(prismaMock.lead.update).not.toHaveBeenCalled()
      expect(contactsMock.linkContactToClient).not.toHaveBeenCalled()
      expect(contactsMock.removeLead).not.toHaveBeenCalled()
    })
  }
})

describe('listLeads', () => {
  it('lists newest first with the next cursor and serializes dates', async () => {
    prismaMock.lead.findMany.mockResolvedValue([leadRow(), leadRow({ id: 'l2' }), leadRow({ id: 'l3' })])

    const r = await listLeads({ limit: 2 })

    expect(prismaMock.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 3 })
    )
    expect(r.data?.items).toHaveLength(2)
    expect(r.data?.nextCursor).toBe('l2')
    expect(r.data?.items[0].createdAt).toBe('2026-10-20T10:00:00.000Z')
  })

  it('filters by status and by name or phone digits', async () => {
    await listLeads({ status: 'NEW', q: 'ana 300' })

    const where = prismaMock.lead.findMany.mock.calls[0][0].where
    expect(where.status).toBe('NEW')
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { displayName: { contains: 'ana 300', mode: 'insensitive' } },
        { fullName: { contains: 'ana 300', mode: 'insensitive' } },
        { phoneE164: { contains: '300' } },
      ])
    )
  })

  it('rejects an unknown status', async () => {
    const r = await listLeads({ status: 'WON' as 'NEW' })

    expect(r.success).toBe(false)
    expect(prismaMock.lead.findMany).not.toHaveBeenCalled()
  })
})

describe('updateLead', () => {
  it('saves trimmed details and stores blanks as null', async () => {
    const r = await updateLead({
      leadId: LEAD,
      fullName: '  Ana Pérez ',
      email: '',
      identificationType: 'CEDULA',
      identificationNumber: '1000000000',
      notes: 'Pidió cotización',
    })

    expect(prismaMock.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: LEAD },
        data: {
          fullName: 'Ana Pérez',
          email: null,
          identificationType: 'CEDULA',
          identificationNumber: '1000000000',
          notes: 'Pidió cotización',
        },
      })
    )
    expect(r.success).toBe(true)
  })

  it('rejects an invalid email', async () => {
    const r = await updateLead({ leadId: LEAD, email: 'no-es-correo' })

    expect(r).toEqual({ success: false, error: 'Correo inválido' })
    expect(prismaMock.lead.update).not.toHaveBeenCalled()
  })
})

describe('setLeadStatus', () => {
  it('moves a lead between NEW, CONTACTED and DISCARDED', async () => {
    const r = await setLeadStatus({ leadId: LEAD, status: 'DISCARDED' })

    expect(prismaMock.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: LEAD }, data: { status: 'DISCARDED' } })
    )
    expect(r.success).toBe(true)
  })

  it('never sets CONVERTED by hand (only convertLead does)', async () => {
    const r = await setLeadStatus({ leadId: LEAD, status: 'CONVERTED' as 'NEW' })

    expect(r.success).toBe(false)
    expect(prismaMock.lead.update).not.toHaveBeenCalled()
  })

  it('does not reopen a converted lead (that is unlinking the contact)', async () => {
    prismaMock.lead.findUnique.mockResolvedValue(leadRow({ status: 'CONVERTED' }))

    const r = await setLeadStatus({ leadId: LEAD, status: 'NEW' })

    expect(r).toEqual({
      success: false,
      error: 'El lead ya es cliente. Para revertirlo, desvincule el contacto desde la conversación.',
    })
    expect(prismaMock.lead.update).not.toHaveBeenCalled()
  })
})

describe('convertLead (S-LD-4)', () => {
  it('links the contact to the new client, which converts the lead, and bumps the conversation', async () => {
    prismaMock.lead.findUnique
      .mockResolvedValueOnce(leadRow())
      .mockResolvedValueOnce(leadRow({ status: 'CONVERTED', convertedClient: { id: CLIENT, fullName: 'Ana' } }))

    const r = await convertLead({ leadId: LEAD, clientId: CLIENT })

    expect(contactsMock.linkContactToClient).toHaveBeenCalledWith('contact-1', CLIENT)
    expect(prismaMock.conversation.updateMany).toHaveBeenCalledWith({
      where: { contactId: 'contact-1' },
      data: { updatedAt: expect.any(Date) },
    })
    expect(r.success && r.data).toMatchObject({ status: 'CONVERTED', convertedClient: { id: CLIENT } })
  })

  it('reports a client that cannot be linked', async () => {
    contactsMock.linkContactToClient.mockResolvedValue({ ok: false, code: 'CLIENT_NOT_FOUND' })

    expect(await convertLead({ leadId: LEAD, clientId: CLIENT })).toEqual({
      success: false,
      error: 'Cliente no encontrado',
    })
  })

  it('refuses a lead that is already converted', async () => {
    prismaMock.lead.findUnique.mockResolvedValue(leadRow({ status: 'CONVERTED' }))

    const r = await convertLead({ leadId: LEAD, clientId: CLIENT })

    expect(r).toEqual({ success: false, error: 'El lead ya fue convertido en cliente' })
    expect(contactsMock.linkContactToClient).not.toHaveBeenCalled()
  })

  it('reports a missing lead', async () => {
    prismaMock.lead.findUnique.mockResolvedValue(null)

    expect(await convertLead({ leadId: LEAD, clientId: CLIENT })).toEqual({
      success: false,
      error: 'Lead no encontrado',
    })
  })
})

describe('deleteLead', () => {
  it('removes the lead through removeLead so it is never recreated', async () => {
    const r = await deleteLead({ leadId: LEAD })

    expect(contactsMock.removeLead).toHaveBeenCalledWith('contact-1')
    expect(r).toEqual({ success: true, data: { id: LEAD } })
  })

  it('reports a missing lead', async () => {
    prismaMock.lead.findUnique.mockResolvedValue(null)

    expect(await deleteLead({ leadId: LEAD })).toEqual({ success: false, error: 'Lead no encontrado' })
    expect(contactsMock.removeLead).not.toHaveBeenCalled()
  })
})
