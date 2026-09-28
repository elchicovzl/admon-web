/**
 * affiliation-affiliated-as.test.ts
 *
 * Verifies T2 of client-multi-type: `createAffiliation` validates the
 * user-chosen `affiliatedAs` role against the client's own `clientTypes`.
 *
 * - A single-type client is accepted when `affiliatedAs` matches its sole type.
 * - A multi-type client is accepted when `affiliatedAs` is one of its types.
 * - Any client is rejected when `affiliatedAs` is NOT one of its types.
 *
 * All enums are real Prisma values. NEVER 'PERSONA', 'MEDIO_TIEMPO', 'PART_TIME',
 * or numeric work-day strings.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
  ClientType,
  AffiliationProcessType,
  AffiliationSubProcessType,
  UserRole,
} from '@prisma/client'

// ---------------------------------------------------------------------------
// Hoist the mock objects so they are accessible inside vi.mock() factories.
// ---------------------------------------------------------------------------

const { prismaMock, authMock } = vi.hoisted(() => {
  const prismaMock = {
    client: {
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    employment: {
      findMany: vi.fn(),
    },
    affiliation: {
      findFirst: vi.fn(),
      create: vi.fn(),
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

import { createAffiliation } from '../affiliation.actions'

// ---------------------------------------------------------------------------
// Test ID constants — valid for Zod v3 `.cuid()` (/^c[^\s-]{8,}$/i)
// ---------------------------------------------------------------------------

const CLIENT_ID = 'cclientidtest001'
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

function basePayload(affiliatedAs: ClientType) {
  return {
    clientId: CLIENT_ID,
    affiliatedAs,
    processType: AffiliationProcessType.DEPENDIENTE,
    subProcesses: [{ type: AffiliationSubProcessType.EPS }],
  }
}

describe('createAffiliation — affiliatedAs validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupManagerSession()
    prismaMock.user.findMany.mockResolvedValue([])
    prismaMock.affiliation.findFirst.mockResolvedValue(null)
    prismaMock.affiliation.create.mockResolvedValue({
      id: 'cnewaffil000003',
      affiliationNumber: 'PROC-00001',
      clientId: CLIENT_ID,
      affiliatedAs: ClientType.INDEPENDIENTE,
      processType: AffiliationProcessType.DEPENDIENTE,
      processTypeOther: null,
      startDate: null,
      note: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('rejects when affiliatedAs is not one of the client types', async () => {
    prismaMock.client.findUnique.mockResolvedValue({
      id: CLIENT_ID,
      clientTypes: [ClientType.EMPLEADO],
      isActive: true,
      fullName: 'Solo Empleado',
    })

    const result = await createAffiliation(basePayload(ClientType.EMPRESA))

    expect(result.success).toBe(false)
    expect(result.error).toBe(
      'El rol de afiliación seleccionado no corresponde a los tipos del cliente'
    )
    expect(prismaMock.affiliation.create).not.toHaveBeenCalled()
  })

  it('accepts a single-type client affiliating as its sole type (auto-selected path)', async () => {
    prismaMock.client.findUnique.mockResolvedValue({
      id: CLIENT_ID,
      clientTypes: [ClientType.INDEPENDIENTE],
      isActive: true,
      fullName: 'Solo Independiente',
    })

    const result = await createAffiliation(basePayload(ClientType.INDEPENDIENTE))

    expect(result.success).toBe(true)
    expect(prismaMock.affiliation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ affiliatedAs: ClientType.INDEPENDIENTE }),
      })
    )
  })

  it('accepts a multi-type client affiliating as one of its chosen types', async () => {
    prismaMock.client.findUnique.mockResolvedValue({
      id: CLIENT_ID,
      clientTypes: [ClientType.EMPLEADO, ClientType.EMPRESA],
      isActive: true,
      fullName: 'Multi Type Co',
    })

    const result = await createAffiliation(basePayload(ClientType.EMPRESA))

    expect(result.success).toBe(true)
    expect(prismaMock.affiliation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ affiliatedAs: ClientType.EMPRESA }),
      })
    )
  })

  it('rejects a multi-type client affiliating as a type it does not have', async () => {
    prismaMock.client.findUnique.mockResolvedValue({
      id: CLIENT_ID,
      clientTypes: [ClientType.EMPLEADO, ClientType.EMPRESA],
      isActive: true,
      fullName: 'Multi Type Co',
    })

    const result = await createAffiliation(basePayload(ClientType.INDEPENDIENTE))

    expect(result.success).toBe(false)
    expect(result.error).toBe(
      'El rol de afiliación seleccionado no corresponde a los tipos del cliente'
    )
  })

  it('rejects employees in sub-processes when affiliatedAs is not EMPRESA, even if the client also has EMPRESA', async () => {
    prismaMock.client.findUnique.mockResolvedValue({
      id: CLIENT_ID,
      clientTypes: [ClientType.EMPRESA, ClientType.INDEPENDIENTE],
      isActive: true,
      fullName: 'Multi Type Co',
    })

    const result = await createAffiliation({
      clientId: CLIENT_ID,
      affiliatedAs: ClientType.INDEPENDIENTE,
      processType: AffiliationProcessType.DEPENDIENTE,
      subProcesses: [{ type: AffiliationSubProcessType.EPS, employeeId: 'cemployeeid0099' }],
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe(
      'Solo las afiliaciones registradas como EMPRESA pueden tener empleados en sub-procesos'
    )
    expect(prismaMock.employment.findMany).not.toHaveBeenCalled()
  })
})
