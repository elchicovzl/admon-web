/**
 * client.actions.test.ts
 *
 * Focused coverage for the client-multi-type migration:
 *   - updateClient preserves employeeType/workDaysRange when clientTypes
 *     still includes EMPLEADO (even combined with another type).
 *   - updateClient nulls employeeType/workDaysRange when clientTypes no
 *     longer includes EMPLEADO.
 *
 * All enums use REAL Prisma values from @prisma/client.
 * IDs must pass z.string().cuid() → regex /^c[^\s-]{8,}$/i
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClientType, EmployeeType, UserRole, IdentificationType, WorkDaysRange } from '@prisma/client'

const ID = {
  CLIENT_A: 'cclientaaaa0001',
  MANAGER: 'cmanagerxx0001',
} as const

const { prismaMock, authMock } = vi.hoisted(() => {
  const clientMock = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  }
  return {
    prismaMock: { client: clientMock },
    authMock: vi.fn(),
  }
})

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/auth/auth', () => ({ auth: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('react', () => ({
  cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}))

import { updateClient } from '../client.actions'

const MANAGER_SESSION = {
  user: {
    id: ID.MANAGER,
    name: 'Manager',
    email: 'manager@test.com',
    image: null,
    role: UserRole.MANAGER,
    isActive: true,
  },
  expires: new Date(Date.now() + 3_600_000).toISOString(),
}

function existingClientRow() {
  return {
    id: ID.CLIENT_A,
    fullName: 'Client A',
    identificationType: IdentificationType.CEDULA,
    identificationNumber: '1234567890',
    clientTypes: [ClientType.EMPLEADO],
    employeeType: EmployeeType.TIEMPO_COMPLETO,
    workDaysRange: null,
    email: 'clienta@test.com',
    phone: '3001234567',
    status: 'ACTIVO',
    isActive: true,
    companyId: null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue(MANAGER_SESSION)
  prismaMock.client.findUnique.mockResolvedValue(existingClientRow())
  prismaMock.client.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ ...existingClientRow(), ...data })
  )
})

describe('updateClient — employeeType/workDaysRange preservation (REQ client-multi-type)', () => {
  it('preserves employeeType and workDaysRange when clientTypes still includes EMPLEADO plus another type', async () => {
    const result = await updateClient(ID.CLIENT_A, {
      clientTypes: [ClientType.EMPLEADO, ClientType.INDEPENDIENTE],
      employeeType: EmployeeType.TIEMPO_PARCIAL,
      workDaysRange: WorkDaysRange.DIAS_1_7,
    })

    expect(result.success).toBe(true)
    const updateCall = prismaMock.client.update.mock.calls[0]?.[0]
    expect(updateCall.data.employeeType).toBe(EmployeeType.TIEMPO_PARCIAL)
    expect(updateCall.data.workDaysRange).toBe(WorkDaysRange.DIAS_1_7)
  })

  it('nulls employeeType and workDaysRange when clientTypes no longer includes EMPLEADO', async () => {
    const result = await updateClient(ID.CLIENT_A, {
      clientTypes: [ClientType.INDEPENDIENTE],
    })

    expect(result.success).toBe(true)
    const updateCall = prismaMock.client.update.mock.calls[0]?.[0]
    expect(updateCall.data.employeeType).toBeNull()
    expect(updateCall.data.workDaysRange).toBeNull()
  })

  it('leaves employeeType/workDaysRange untouched when clientTypes is not part of the update payload', async () => {
    const result = await updateClient(ID.CLIENT_A, {
      fullName: 'Client A Renamed',
    })

    expect(result.success).toBe(true)
    const updateCall = prismaMock.client.update.mock.calls[0]?.[0]
    expect(updateCall.data.employeeType).toBeUndefined()
    expect(updateCall.data.workDaysRange).toBeUndefined()
  })
})
