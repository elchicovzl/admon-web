/**
 * affiliation-my-assignments-search.test.ts
 *
 * T1 of unified-tables: "Mis Asignaciones" gets a single search input that
 * matches a sub-process when ANY of these contains the text
 * (case-insensitive, partial):
 * - the affiliation's client (`fullName` or `identificationNumber` — covers
 *   companies and independents, since NIT/RUT/cédula are all stored in
 *   `identificationNumber`)
 * - the sub-process employee (`fullName` or `identificationNumber`)
 *
 * Sub-processes without an employee must still match via the affiliation's
 * client.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AffiliationStatus, UserRole } from '@prisma/client'

// ---------------------------------------------------------------------------
// Hoist the mock objects so they are accessible inside vi.mock() factories.
// ---------------------------------------------------------------------------

const { prismaMock, authMock } = vi.hoisted(() => {
  const prismaMock = {
    affiliationSubProcess: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  }
  const authMock = vi.fn()
  return { prismaMock, authMock }
})

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/auth/auth', () => ({ auth: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// cache() wraps some exported functions at module-load time — return identity
vi.mock('react', () => ({
  cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}))

// Used inside functions (not at module level), mocked for safety
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({})),
  DeleteObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
}))
vi.mock('@/lib/encryption/credentials', () => ({
  decryptPassword: vi.fn(),
}))
vi.mock('@/lib/email', () => ({
  sendAffiliationCompletedEmail: vi.fn(),
}))
vi.mock('@react-email/render', () => ({
  render: vi.fn(() => '<html></html>'),
}))
vi.mock('@/emails/affiliation-completed-email', () => ({
  default: vi.fn(() => null),
}))

// ---------------------------------------------------------------------------
// Action imports (after mocks so mocked modules are used)
// ---------------------------------------------------------------------------

import { getMyAssignments, buildAssignmentSearchWhere } from '../affiliation.actions'

const USER_ID = 'cuseridtest00003'

function setupManagerSession() {
  authMock.mockResolvedValue({
    user: {
      id: USER_ID,
      role: UserRole.MANAGER,
      name: 'Test Manager',
      email: 'manager@test.com',
    },
    expires: '2099-01-01',
  })
}

describe('buildAssignmentSearchWhere', () => {
  it('returns undefined for an empty, missing, or whitespace-only query', () => {
    expect(buildAssignmentSearchWhere(undefined)).toBeUndefined()
    expect(buildAssignmentSearchWhere('')).toBeUndefined()
    expect(buildAssignmentSearchWhere('   ')).toBeUndefined()
  })

  it('builds a four-way OR across client and employee name/identification, trimmed', () => {
    const result = buildAssignmentSearchWhere('  acme  ')

    expect(result).toEqual({
      OR: [
        { affiliation: { client: { fullName: { contains: 'acme', mode: 'insensitive' } } } },
        {
          affiliation: {
            client: { identificationNumber: { contains: 'acme', mode: 'insensitive' } },
          },
        },
        { employee: { fullName: { contains: 'acme', mode: 'insensitive' } } },
        { employee: { identificationNumber: { contains: 'acme', mode: 'insensitive' } } },
      ],
    })
  })
})

describe('getMyAssignments — unified `q` search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupManagerSession()
    prismaMock.affiliationSubProcess.findMany.mockResolvedValue([])
    prismaMock.affiliationSubProcess.count.mockResolvedValue(0)
  })

  it('adds the four-way OR clause to both findMany and count while keeping base constraints', async () => {
    const result = await getMyAssignments({ q: 'Juan Perez' })

    expect(result.success).toBe(true)

    const expectedWhere = {
      assignedToId: USER_ID,
      affiliation: {
        isActive: true,
        status: AffiliationStatus.ACTIVE,
      },
      OR: [
        { affiliation: { client: { fullName: { contains: 'Juan Perez', mode: 'insensitive' } } } },
        {
          affiliation: {
            client: { identificationNumber: { contains: 'Juan Perez', mode: 'insensitive' } },
          },
        },
        { employee: { fullName: { contains: 'Juan Perez', mode: 'insensitive' } } },
        { employee: { identificationNumber: { contains: 'Juan Perez', mode: 'insensitive' } } },
      ],
    }

    expect(prismaMock.affiliationSubProcess.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere })
    )
    expect(prismaMock.affiliationSubProcess.count).toHaveBeenCalledWith({ where: expectedWhere })
  })

  it('omits the OR clause when `q` is absent, keeping only assignment/affiliation constraints', async () => {
    await getMyAssignments({})

    const expectedWhere = {
      assignedToId: USER_ID,
      affiliation: {
        isActive: true,
        status: AffiliationStatus.ACTIVE,
      },
    }

    expect(prismaMock.affiliationSubProcess.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere })
    )
    expect(prismaMock.affiliationSubProcess.count).toHaveBeenCalledWith({ where: expectedWhere })
  })

  it('combines `q` with other filters (status, subProcess, processType) without clobbering them', async () => {
    await getMyAssignments({
      q: '123456',
      status: 'IN_PROGRESS' as any,
      subProcess: 'EPS' as any,
      processType: 'DEPENDIENTE' as any,
    })

    const [callArgs] = prismaMock.affiliationSubProcess.findMany.mock.calls[0]
    expect(callArgs.where).toMatchObject({
      assignedToId: USER_ID,
      status: 'IN_PROGRESS',
      type: 'EPS',
      affiliation: {
        isActive: true,
        status: AffiliationStatus.ACTIVE,
        processType: 'DEPENDIENTE',
      },
    })
    expect(callArgs.where.OR).toEqual(buildAssignmentSearchWhere('123456')!.OR)
  })
})
