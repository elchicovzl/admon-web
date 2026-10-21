import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '@prisma/client'

const { prismaMock, authMock, hasWhatsAppAccessMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    whatsAppSettings: { findUnique: vi.fn(), upsert: vi.fn() },
    $queryRaw: vi.fn(),
  },
  authMock: vi.fn(),
  hasWhatsAppAccessMock: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/auth/auth', () => ({ auth: authMock }))
vi.mock('@/lib/auth/rbac', () => ({ hasWhatsAppAccess: hasWhatsAppAccessMock }))
vi.mock('@/lib/storage/r2', () => ({ presignGet: vi.fn() }))
vi.mock('@/lib/whatsapp/outbound', () => ({}))

import { getAiSettings, getUsageSummary, setAiEnabled } from '../whatsapp.actions'

const UPDATED_AT = new Date('2026-10-20T15:00:00.000Z')

function asSuperAdmin() {
  authMock.mockResolvedValue({ user: { id: 'admin-1', role: UserRole.SUPER_ADMIN } })
  prismaMock.user.findUnique.mockResolvedValue({ role: UserRole.SUPER_ADMIN, isActive: true })
}

function asManager() {
  authMock.mockResolvedValue({ user: { id: 'mgr-1', role: UserRole.MANAGER } })
  prismaMock.user.findUnique.mockResolvedValue({ role: UserRole.MANAGER, isActive: true })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.stubEnv('WHATSAPP_AI_ENABLED', 'true')
  hasWhatsAppAccessMock.mockResolvedValue(true)
  asSuperAdmin()
  prismaMock.whatsAppSettings.findUnique.mockResolvedValue({
    aiEnabled: false,
    updatedAt: UPDATED_AT,
    updatedById: null,
  })
  prismaMock.whatsAppSettings.upsert.mockImplementation(async ({ create }) => ({
    aiEnabled: create.aiEnabled,
    updatedAt: UPDATED_AT,
    updatedById: create.updatedById,
  }))
})

describe('setAiEnabled (S1, AI-12)', () => {
  it('lets a SUPER_ADMIN turn the global AI switch on, recording who did it', async () => {
    const r = await setAiEnabled({ enabled: true })

    expect(prismaMock.whatsAppSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'singleton' },
        create: { id: 'singleton', aiEnabled: true, updatedById: 'admin-1' },
        update: { aiEnabled: true, updatedById: 'admin-1' },
      })
    )
    expect(r).toEqual({
      success: true,
      data: { envEnabled: true, aiEnabled: true, canManage: true, updatedAt: UPDATED_AT.toISOString() },
    })
  })

  it('lets a SUPER_ADMIN turn it off', async () => {
    const r = await setAiEnabled({ enabled: false })

    expect(prismaMock.whatsAppSettings.upsert.mock.calls[0][0].update).toEqual({
      aiEnabled: false,
      updatedById: 'admin-1',
    })
    expect(r.success).toBe(true)
    expect(r.data?.aiEnabled).toBe(false)
  })

  it('denies a MANAGER with WhatsApp access and writes nothing', async () => {
    asManager()

    const r = await setAiEnabled({ enabled: true })

    expect(r).toEqual({ success: false, error: 'Solo un super administrador puede cambiar la IA global' })
    expect(prismaMock.whatsAppSettings.upsert).not.toHaveBeenCalled()
  })

  it('reads the role from the database, not from the session token', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', role: UserRole.SUPER_ADMIN } })
    prismaMock.user.findUnique.mockResolvedValue({ role: UserRole.MANAGER, isActive: true })

    const r = await setAiEnabled({ enabled: true })

    expect(r.success).toBe(false)
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u1' } }))
    expect(prismaMock.whatsAppSettings.upsert).not.toHaveBeenCalled()
  })

  it('denies an inactive SUPER_ADMIN', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: UserRole.SUPER_ADMIN, isActive: false })

    const r = await setAiEnabled({ enabled: true })

    expect(r.success).toBe(false)
    expect(prismaMock.whatsAppSettings.upsert).not.toHaveBeenCalled()
  })

  it('denies callers without module access before any role lookup', async () => {
    hasWhatsAppAccessMock.mockResolvedValue(false)

    const r = await setAiEnabled({ enabled: true })

    expect(r).toEqual({ success: false, error: 'No tienes acceso al módulo de WhatsApp' })
    expect(prismaMock.whatsAppSettings.upsert).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated callers', async () => {
    authMock.mockResolvedValue(null)

    const r = await setAiEnabled({ enabled: true })

    expect(r).toEqual({ success: false, error: 'No autenticado' })
    expect(prismaMock.whatsAppSettings.upsert).not.toHaveBeenCalled()
  })

  it('rejects a non-boolean value', async () => {
    const r = await setAiEnabled({ enabled: 'yes' as unknown as boolean })

    expect(r.success).toBe(false)
    expect(prismaMock.whatsAppSettings.upsert).not.toHaveBeenCalled()
  })
})

describe('getAiSettings (S3)', () => {
  it('shows a MANAGER the state without the right to change it', async () => {
    asManager()
    prismaMock.whatsAppSettings.findUnique.mockResolvedValue({ aiEnabled: true, updatedAt: UPDATED_AT })

    const r = await getAiSettings()

    expect(r).toEqual({
      success: true,
      data: { envEnabled: true, aiEnabled: true, canManage: false, updatedAt: UPDATED_AT.toISOString() },
    })
  })

  it('reports the server flag off when WHATSAPP_AI_ENABLED is not "true"', async () => {
    vi.stubEnv('WHATSAPP_AI_ENABLED', 'false')

    const r = await getAiSettings()

    expect(r.data?.envEnabled).toBe(false)
  })

  it('treats a missing settings row as off', async () => {
    prismaMock.whatsAppSettings.findUnique.mockResolvedValue(null)

    const r = await getAiSettings()

    expect(r.data).toMatchObject({ aiEnabled: false, updatedAt: null })
  })

  it('requires module access', async () => {
    hasWhatsAppAccessMock.mockResolvedValue(false)

    const r = await getAiSettings()

    expect(r.success).toBe(false)
    expect(prismaMock.whatsAppSettings.findUnique).not.toHaveBeenCalled()
  })
})

describe('getUsageSummary (S2, AI-13)', () => {
  const rows = [
    {
      day: new Date('2026-10-19T00:00:00.000Z'),
      turns: 3n,
      replied: 2n,
      escalated: 1n,
      failed: 0n,
      inputTokens: 1200n,
      outputTokens: 300n,
      transcriptions: 1n,
      audioSeconds: 90,
      costUsd: '0.012345',
    },
    {
      day: new Date('2026-10-20T00:00:00.000Z'),
      turns: 1n,
      replied: 0n,
      escalated: 0n,
      failed: 1n,
      inputTokens: 400n,
      outputTokens: 0n,
      transcriptions: 0n,
      audioSeconds: null,
      costUsd: null,
    },
  ]

  it('aggregates tokens, audio minutes and cost per day, plus totals', async () => {
    prismaMock.$queryRaw.mockResolvedValue(rows)

    const r = await getUsageSummary({})

    expect(r).toEqual({
      success: true,
      data: {
        days: 30,
        perDay: [
          {
            day: '2026-10-19',
            turns: 3,
            replied: 2,
            escalated: 1,
            failed: 0,
            inputTokens: 1200,
            outputTokens: 300,
            transcriptions: 1,
            audioMinutes: 1.5,
            costUsd: 0.012345,
          },
          {
            day: '2026-10-20',
            turns: 1,
            replied: 0,
            escalated: 0,
            failed: 1,
            inputTokens: 400,
            outputTokens: 0,
            transcriptions: 0,
            audioMinutes: 0,
            costUsd: 0,
          },
        ],
        totals: {
          turns: 4,
          replied: 2,
          escalated: 1,
          failed: 1,
          inputTokens: 1600,
          outputTokens: 300,
          transcriptions: 1,
          audioMinutes: 1.5,
          costUsd: 0.012345,
        },
      },
    })
  })

  it('groups by Bogota day over the requested window and reads no content columns', async () => {
    prismaMock.$queryRaw.mockResolvedValue([])

    await getUsageSummary({ days: 7 })

    const sql = prismaMock.$queryRaw.mock.calls[0][0]
    const text: string = sql.strings.join('?')
    expect(text).toContain("AT TIME ZONE 'America/Bogota'")
    expect(sql.values).toContain(7)
    for (const column of ['toolCalls', 'retrievalScores', 'retrievedChunkIds', 'error', 'conversationId', 'messageId']) {
      expect(text).not.toContain(`"${column}"`)
    }
  })

  it('returns zero totals when there is no usage', async () => {
    prismaMock.$queryRaw.mockResolvedValue([])

    const r = await getUsageSummary({})

    expect(r.data?.perDay).toEqual([])
    expect(r.data?.totals).toEqual({
      turns: 0,
      replied: 0,
      escalated: 0,
      failed: 0,
      inputTokens: 0,
      outputTokens: 0,
      transcriptions: 0,
      audioMinutes: 0,
      costUsd: 0,
    })
  })

  it.each([0, 91, 2.5])('rejects a window of %s days', async (days) => {
    const r = await getUsageSummary({ days })

    expect(r.success).toBe(false)
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
  })

  it('requires module access', async () => {
    hasWhatsAppAccessMock.mockResolvedValue(false)

    const r = await getUsageSummary({})

    expect(r.success).toBe(false)
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
  })
})
