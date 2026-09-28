/**
 * affiliation-archived-search.test.ts
 *
 * T3 of unified-tables: "Archivadas" gets a single search input, matching
 * an archived affiliation when ANY of these contains the text
 * (case-insensitive, partial):
 * - the affiliation's own affiliationNumber
 * - the affiliation's client (`fullName` or `identificationNumber` —
 *   covers companies and independents)
 * - any of the affiliation's sub-process employees (`fullName` or
 *   `identificationNumber`)
 *
 * Also covers server-side pagination (skip/take + count) and sorting.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AffiliationStatus, UserRole } from '@prisma/client'

// ---------------------------------------------------------------------------
// Hoist the mock objects so they are accessible inside vi.mock() factories.
// ---------------------------------------------------------------------------

const { prismaMock, authMock } = vi.hoisted(() => {
  const prismaMock = {
    affiliation: {
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

import { getArchivedAffiliations, buildArchivedWhere } from '../affiliation.actions'

const USER_ID = 'cuseridtest00004'

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

describe('buildArchivedWhere', () => {
  it('returns undefined for an empty, missing, or whitespace-only query', () => {
    expect(buildArchivedWhere(undefined)).toBeUndefined()
    expect(buildArchivedWhere('')).toBeUndefined()
    expect(buildArchivedWhere('   ')).toBeUndefined()
  })

  it('builds an OR across affiliationNumber, client and sub-process employee, trimmed', () => {
    const result = buildArchivedWhere('  acme  ')

    expect(result).toEqual({
      OR: [
        { affiliationNumber: { contains: 'acme', mode: 'insensitive' } },
        { client: { fullName: { contains: 'acme', mode: 'insensitive' } } },
        { client: { identificationNumber: { contains: 'acme', mode: 'insensitive' } } },
        {
          subProcesses: {
            some: { employee: { fullName: { contains: 'acme', mode: 'insensitive' } } },
          },
        },
        {
          subProcesses: {
            some: { employee: { identificationNumber: { contains: 'acme', mode: 'insensitive' } } },
          },
        },
      ],
    })
  })
})

describe('getArchivedAffiliations — search, pagination and sorting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupManagerSession()
    prismaMock.affiliation.findMany.mockResolvedValue([])
    prismaMock.affiliation.count.mockResolvedValue(0)
  })

  it('adds the OR clause to both findMany and count while keeping the ARCHIVED base constraint', async () => {
    const result = await getArchivedAffiliations({ q: 'Juan Perez' })

    expect(result.success).toBe(true)

    const expectedWhere = {
      status: AffiliationStatus.ARCHIVED,
      OR: buildArchivedWhere('Juan Perez')!.OR,
    }

    expect(prismaMock.affiliation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere })
    )
    expect(prismaMock.affiliation.count).toHaveBeenCalledWith({ where: expectedWhere })
  })

  it('omits the OR clause when `q` is absent, keeping only the ARCHIVED constraint', async () => {
    await getArchivedAffiliations({})

    const expectedWhere = { status: AffiliationStatus.ARCHIVED }

    expect(prismaMock.affiliation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere })
    )
    expect(prismaMock.affiliation.count).toHaveBeenCalledWith({ where: expectedWhere })
  })

  it('applies default pagination (page 1, pageSize 25) and default sort (sentAt desc)', async () => {
    await getArchivedAffiliations({})

    const [callArgs] = prismaMock.affiliation.findMany.mock.calls[0]
    expect(callArgs.skip).toBe(0)
    expect(callArgs.take).toBe(25)
    expect(callArgs.orderBy).toEqual({ sentAt: 'desc' })
  })

  it('applies skip/take for a requested page and pageSize', async () => {
    await getArchivedAffiliations({ page: 3, pageSize: 10 })

    const [callArgs] = prismaMock.affiliation.findMany.mock.calls[0]
    expect(callArgs.skip).toBe(20)
    expect(callArgs.take).toBe(10)
  })

  it('maps sortBy=affiliationNumber/client/sentBy to the right orderBy shape', async () => {
    await getArchivedAffiliations({ sortBy: 'affiliationNumber', sortDir: 'asc' })
    expect(prismaMock.affiliation.findMany.mock.calls[0][0].orderBy).toEqual({
      affiliationNumber: 'asc',
    })

    await getArchivedAffiliations({ sortBy: 'client', sortDir: 'asc' })
    expect(prismaMock.affiliation.findMany.mock.calls[1][0].orderBy).toEqual({
      client: { fullName: 'asc' },
    })

    await getArchivedAffiliations({ sortBy: 'sentBy', sortDir: 'desc' })
    expect(prismaMock.affiliation.findMany.mock.calls[2][0].orderBy).toEqual({
      sentBy: { name: 'desc' },
    })
  })

  it('returns a PaginatedResult shape with total/page/pageSize/totalPages', async () => {
    prismaMock.affiliation.count.mockResolvedValue(42)

    const result = await getArchivedAffiliations({ page: 2, pageSize: 10 })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toMatchObject({
        total: 42,
        page: 2,
        pageSize: 10,
        totalPages: 5,
      })
    }
  })

  it('rejects when the caller is not a manager or admin', async () => {
    authMock.mockResolvedValue(null)

    const result = await getArchivedAffiliations({})

    expect(result.success).toBe(false)
    expect(prismaMock.affiliation.findMany).not.toHaveBeenCalled()
  })
})
