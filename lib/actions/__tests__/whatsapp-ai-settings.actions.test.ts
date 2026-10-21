import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma, UserRole } from '@prisma/client'

const { prismaMock, authMock, hasWhatsAppAccessMock, aiConfigMock, spentTodayMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    whatsAppSettings: { findUnique: vi.fn(), upsert: vi.fn() },
    $queryRaw: vi.fn(),
  },
  authMock: vi.fn(),
  hasWhatsAppAccessMock: vi.fn(),
  aiConfigMock: vi.fn(),
  spentTodayMock: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/auth/auth', () => ({ auth: authMock }))
vi.mock('@/lib/auth/rbac', () => ({ hasWhatsAppAccess: hasWhatsAppAccessMock }))
vi.mock('@/lib/storage/r2', () => ({ presignGet: vi.fn() }))
vi.mock('@/lib/whatsapp/outbound', () => ({}))
vi.mock('@/lib/config/runtime-config', () => ({ getAiConfig: aiConfigMock }))
vi.mock('@/lib/ai/limits', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai/limits')>()),
  spentTodayUsd: spentTodayMock,
}))

import { getAiLimitSettings, getAiSettings, getUsageSummary, setAiEnabled, updateAiLimitSettings } from '../whatsapp.actions'

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
  aiConfigMock.mockReturnValue({ maxTurnsPerDay: 30, maxConsecutiveFailures: 2, forbiddenTopics: ['política'] })
  spentTodayMock.mockResolvedValue(1.234567)
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
      turns: BigInt(3),
      replied: BigInt(2),
      escalated: BigInt(1),
      failed: BigInt(0),
      inputTokens: BigInt(1200),
      outputTokens: BigInt(300),
      transcriptions: BigInt(1),
      audioSeconds: 90,
      costUsd: '0.012345',
    },
    {
      day: new Date('2026-10-20T00:00:00.000Z'),
      turns: BigInt(1),
      replied: BigInt(0),
      escalated: BigInt(0),
      failed: BigInt(1),
      inputTokens: BigInt(400),
      outputTokens: BigInt(0),
      transcriptions: BigInt(0),
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

describe('getAiLimitSettings (S2, S3)', () => {
  it('gives a SUPER_ADMIN the saved limits, the server values they fall back to, and today\'s spend', async () => {
    prismaMock.whatsAppSettings.findUnique.mockResolvedValue({
      dailyBudgetUsd: new Prisma.Decimal('20.00'),
      maxTurnsPerDay: null,
      maxConsecutiveFailures: 3,
      forbiddenTopics: ['criptomonedas'],
    })

    const r = await getAiLimitSettings()

    expect(r).toEqual({
      success: true,
      data: {
        saved: { dailyBudgetUsd: 20, maxTurnsPerDay: null, maxConsecutiveFailures: 3, forbiddenTopics: ['criptomonedas'] },
        server: { maxTurnsPerDay: 30, maxConsecutiveFailures: 2, forbiddenTopics: ['política'] },
        spentTodayUsd: 1.234567,
      },
    })
  })

  it('returns empty saved limits when nothing was saved', async () => {
    prismaMock.whatsAppSettings.findUnique.mockResolvedValue(null)

    const r = await getAiLimitSettings()

    expect(r.data?.saved).toEqual({ dailyBudgetUsd: null, maxTurnsPerDay: null, maxConsecutiveFailures: null, forbiddenTopics: [] })
  })

  it('denies a MANAGER', async () => {
    asManager()

    const r = await getAiLimitSettings()

    expect(r).toEqual({ success: false, error: 'Solo un super administrador puede cambiar la IA global' })
    expect(prismaMock.whatsAppSettings.findUnique).not.toHaveBeenCalled()
  })
})

describe('updateAiLimitSettings (S1-S3)', () => {
  const input = { dailyBudgetUsd: 20, maxTurnsPerDay: 10, maxConsecutiveFailures: 3, forbiddenTopics: [' Criptomonedas ', 'criptomonedas', ''] }

  beforeEach(() => {
    prismaMock.whatsAppSettings.upsert.mockResolvedValue({})
  })

  it('saves the limits for a SUPER_ADMIN, normalizing the topics and recording who changed them', async () => {
    const r = await updateAiLimitSettings(input)

    const data = { dailyBudgetUsd: 20, maxTurnsPerDay: 10, maxConsecutiveFailures: 3, forbiddenTopics: ['Criptomonedas'], updatedById: 'admin-1' }
    expect(prismaMock.whatsAppSettings.upsert).toHaveBeenCalledWith({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    })
    expect(r).toEqual({ success: true, message: 'Límites de IA guardados' })
  })

  it('clears a field with null, so it falls back to the server value (or no cap)', async () => {
    await updateAiLimitSettings({ dailyBudgetUsd: null, maxTurnsPerDay: null, maxConsecutiveFailures: null, forbiddenTopics: [] })

    expect(prismaMock.whatsAppSettings.upsert.mock.calls[0][0].update).toEqual({
      dailyBudgetUsd: null,
      maxTurnsPerDay: null,
      maxConsecutiveFailures: null,
      forbiddenTopics: [],
      updatedById: 'admin-1',
    })
  })

  it('never touches the AI switch', async () => {
    await updateAiLimitSettings(input)

    expect(prismaMock.whatsAppSettings.upsert.mock.calls[0][0].update).not.toHaveProperty('aiEnabled')
    expect(prismaMock.whatsAppSettings.upsert.mock.calls[0][0].create).not.toHaveProperty('aiEnabled')
  })

  it.each([
    ['a zero budget', { dailyBudgetUsd: 0 }],
    ['a budget with more than 2 decimals', { dailyBudgetUsd: 1.234 }],
    ['zero replies per day', { maxTurnsPerDay: 0 }],
    ['a fractional failure cap', { maxConsecutiveFailures: 1.5 }],
    ['a topic longer than 80 characters', { forbiddenTopics: ['x'.repeat(81)] }],
    ['more than 50 topics', { forbiddenTopics: Array.from({ length: 51 }, (_, i) => `tema ${i}`) }],
  ])('rejects %s and writes nothing', async (_label, overrides) => {
    const r = await updateAiLimitSettings({ ...input, ...overrides })

    expect(r.success).toBe(false)
    expect(prismaMock.whatsAppSettings.upsert).not.toHaveBeenCalled()
  })

  it('denies a MANAGER and writes nothing', async () => {
    asManager()

    const r = await updateAiLimitSettings(input)

    expect(r.success).toBe(false)
    expect(prismaMock.whatsAppSettings.upsert).not.toHaveBeenCalled()
  })
})
