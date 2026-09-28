/**
 * client-history-search.test.ts
 *
 * T4 of unified-tables: "Histórico" gets server-side search, pagination and
 * sorting instead of fetching every client and filtering in the browser.
 *
 * `buildClientHistoryWhere({ q, status })` reproduces the exact semantics
 * the removed client-side filter had:
 * - status 'active': status !== 'ELIMINADO'
 * - status 'deleted': status === 'ELIMINADO'
 * - status 'all' (or omitted): no status constraint (includes deleted)
 * - q: matches fullName, identificationNumber, email, or the fullName of a
 *   company from one of the client's active employments.
 *
 * Also covers server-side pagination (skip/take + count) and sorting,
 * including `_count` orderBy for processes/files counts.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { UserRole } from '@prisma/client'

// ---------------------------------------------------------------------------
// Hoist the mock objects so they are accessible inside vi.mock() factories.
// ---------------------------------------------------------------------------

const { prismaMock, authMock } = vi.hoisted(() => {
  const prismaMock = {
    client: {
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

// ---------------------------------------------------------------------------
// Action imports (after mocks so mocked modules are used)
// ---------------------------------------------------------------------------

import { getClientHistoryList, buildClientHistoryWhere } from '../client-history.actions'

const USER_ID = 'cuseridtest00005'

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

describe('buildClientHistoryWhere', () => {
  it('returns an empty where clause for status "all" (or omitted) and no query', () => {
    expect(buildClientHistoryWhere({})).toEqual({})
    expect(buildClientHistoryWhere({ status: 'all' })).toEqual({})
  })

  it('restricts to non-deleted clients for status "active"', () => {
    expect(buildClientHistoryWhere({ status: 'active' })).toEqual({
      status: { not: 'ELIMINADO' },
    })
  })

  it('restricts to soft-deleted clients for status "deleted"', () => {
    expect(buildClientHistoryWhere({ status: 'deleted' })).toEqual({
      status: 'ELIMINADO',
    })
  })

  it('returns undefined-free OR for an empty, missing, or whitespace-only query', () => {
    expect(buildClientHistoryWhere({ q: undefined }).OR).toBeUndefined()
    expect(buildClientHistoryWhere({ q: '' }).OR).toBeUndefined()
    expect(buildClientHistoryWhere({ q: '   ' }).OR).toBeUndefined()
  })

  it('builds an OR across fullName, identificationNumber, email and active employment company, trimmed', () => {
    const result = buildClientHistoryWhere({ q: '  acme  ' })

    expect(result.OR).toEqual([
      { fullName: { contains: 'acme', mode: 'insensitive' } },
      { identificationNumber: { contains: 'acme', mode: 'insensitive' } },
      { email: { contains: 'acme', mode: 'insensitive' } },
      {
        employmentsAsEmployee: {
          some: {
            isActive: true,
            company: { fullName: { contains: 'acme', mode: 'insensitive' } },
          },
        },
      },
    ])
  })

  it('combines a status constraint with the search OR', () => {
    const result = buildClientHistoryWhere({ q: 'juan', status: 'deleted' })

    expect(result).toEqual({
      status: 'ELIMINADO',
      OR: buildClientHistoryWhere({ q: 'juan' }).OR,
    })
  })
})

describe('getClientHistoryList — search, pagination and sorting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupManagerSession()
    prismaMock.client.findMany.mockResolvedValue([])
    prismaMock.client.count.mockResolvedValue(0)
  })

  it('applies the same where clause to findMany and count', async () => {
    const result = await getClientHistoryList({ q: 'Juan Perez', status: 'active' })

    expect(result.success).toBe(true)

    const expectedWhere = buildClientHistoryWhere({ q: 'Juan Perez', status: 'active' })

    expect(prismaMock.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere })
    )
    expect(prismaMock.client.count).toHaveBeenCalledWith({ where: expectedWhere })
  })

  it('defaults to no status constraint (status "all") when omitted, including deleted clients', async () => {
    await getClientHistoryList({})

    expect(prismaMock.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    )
    expect(prismaMock.client.count).toHaveBeenCalledWith({ where: {} })
  })

  it('applies default pagination (page 1, pageSize 25) and default sort (createdAt desc)', async () => {
    await getClientHistoryList({})

    const [callArgs] = prismaMock.client.findMany.mock.calls[0]
    expect(callArgs.skip).toBe(0)
    expect(callArgs.take).toBe(25)
    expect(callArgs.orderBy).toEqual({ createdAt: 'desc' })
  })

  it('applies skip/take for a requested page and pageSize', async () => {
    await getClientHistoryList({ page: 3, pageSize: 10 })

    const [callArgs] = prismaMock.client.findMany.mock.calls[0]
    expect(callArgs.skip).toBe(20)
    expect(callArgs.take).toBe(10)
  })

  it('maps sortBy=fullName to orderBy: { fullName: dir }', async () => {
    await getClientHistoryList({ sortBy: 'fullName', sortDir: 'asc' })
    expect(prismaMock.client.findMany.mock.calls[0][0].orderBy).toEqual({ fullName: 'asc' })
  })

  it('maps sortBy=affiliationsCount/documentsCount to relation _count orderBy', async () => {
    await getClientHistoryList({ sortBy: 'affiliationsCount', sortDir: 'asc' })
    expect(prismaMock.client.findMany.mock.calls[0][0].orderBy).toEqual({
      affiliations: { _count: 'asc' },
    })

    await getClientHistoryList({ sortBy: 'documentsCount', sortDir: 'desc' })
    expect(prismaMock.client.findMany.mock.calls[1][0].orderBy).toEqual({
      documents: { _count: 'desc' },
    })
  })

  it('returns a PaginatedResult shape with total/page/pageSize/totalPages', async () => {
    prismaMock.client.count.mockResolvedValue(42)

    const result = await getClientHistoryList({ page: 2, pageSize: 10 })

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

    const result = await getClientHistoryList({})

    expect(result.success).toBe(false)
    expect(prismaMock.client.findMany).not.toHaveBeenCalled()
  })
})
