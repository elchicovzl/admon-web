/**
 * affiliation-employment-validation.test.ts
 *
 * Verifies REQ-6: affiliation employee validation uses the Employment join table
 * instead of the legacy `Client.companyId + clientType:'EMPLEADO'` check.
 *
 * Covers scenarios 6.1–6.6 from the delta spec.
 *
 * All enums are real Prisma values. NEVER 'PERSONA', 'MEDIO_TIEMPO', 'PART_TIME',
 * or numeric work-day strings.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
  ClientType,
  AffiliationProcessType,
  AffiliationSubProcessType,
  AffiliationStatus,
  UserRole,
} from '@prisma/client'

// ---------------------------------------------------------------------------
// Hoist the mock objects so they are accessible inside vi.mock() factories.
// ---------------------------------------------------------------------------

const { prismaMock, authMock } = vi.hoisted(() => {
  const prismaMock = {
    client: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    employment: {
      findMany: vi.fn(),
    },
    affiliation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    affiliationSubProcess: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  }
  const authMock = vi.fn()
  return { prismaMock, authMock }
})

// ---------------------------------------------------------------------------
// Module mocks (hoisted before all imports by Vitest)
// ---------------------------------------------------------------------------

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

import { createAffiliation, addSubProcesses } from '../affiliation.actions'

// ---------------------------------------------------------------------------
// Test ID constants — valid for Zod v3 `.cuid()` (/^c[^\s-]{8,}$/i)
// ---------------------------------------------------------------------------

const COMPANY_ID = 'ccompanyid000001'   // 16 chars, starts with c ✓
const EMPLOYEE_A = 'cemployeeid00001'   // 16 chars ✓
const EMPLOYEE_B = 'cemployeeid00002'   // 16 chars ✓
const AFFIL_ID   = 'caffiliatid00001'   // 16 chars ✓
const USER_ID    = 'cuseridtest00001'   // 16 chars ✓

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

/** Configures auth() to return an authorized manager session. */
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

/** Configures prisma.client.findUnique to return an EMPRESA client. */
function setupEmpresaClient() {
  prismaMock.client.findUnique.mockResolvedValue({
    id: COMPANY_ID,
    clientType: ClientType.EMPRESA,
    isActive: true,
    fullName: 'Test Company SA',
  })
}

/**
 * Minimal valid payload for createAffiliation.
 * Uses DEPENDIENTE process type (no OTRO branch), one EPS subprocess per employee.
 * No assignedToId → manager validation step is skipped.
 */
function createAffiliationPayload(employeeIds: string[]) {
  return {
    clientId: COMPANY_ID,
    processType: AffiliationProcessType.DEPENDIENTE,
    subProcesses: employeeIds.map((employeeId) => ({
      type: AffiliationSubProcessType.EPS,
      employeeId,
    })),
  }
}

/**
 * Minimal valid payload for addSubProcesses.
 * No assignedToId → manager validation step is skipped.
 */
function addSubProcessesPayload(employeeIds: string[]) {
  return {
    affiliationId: AFFIL_ID,
    subProcesses: employeeIds.map((employeeId) => ({
      type: AffiliationSubProcessType.EPS,
      employeeId,
    })),
  }
}

// ---------------------------------------------------------------------------
// REQ-6: createAffiliation — Employment-based validation
// ---------------------------------------------------------------------------

describe('REQ-6 createAffiliation: Employment-based employee validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupManagerSession()
    setupEmpresaClient()
    // No managers in subProcesses → user.findMany not reached
    prismaMock.user.findMany.mockResolvedValue([])
    // affiliation number generation
    prismaMock.affiliation.findFirst.mockResolvedValue(null)
    // happy-path affiliation creation
    prismaMock.affiliation.create.mockResolvedValue({
      id: 'cnewaffil000001',
      affiliationNumber: 'PROC-00001',
      clientId: COMPANY_ID,
      processType: AffiliationProcessType.DEPENDIENTE,
      processTypeOther: null,
      startDate: null,
      note: null,
      status: AffiliationStatus.ACTIVE,
      subProcesses: [],
      client: { id: COMPANY_ID, fullName: 'Test Company SA' },
      createdBy: { id: USER_ID, name: 'Test Manager', email: 'manager@test.com' },
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  // REQ-6.1 — valid active Employment at the affiliation's company → passes
  it('REQ-6.1: creates affiliation when employee has active Employment at the company', async () => {
    prismaMock.employment.findMany.mockResolvedValue([{ employeeId: EMPLOYEE_A }])

    const result = await createAffiliation(createAffiliationPayload([EMPLOYEE_A]))

    expect(result.success).toBe(true)
    // Verify the correct Employment query was issued
    expect(prismaMock.employment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: COMPANY_ID,
          isActive: true,
          employeeId: { in: [EMPLOYEE_A] },
          employee: { isActive: true },
        }),
        select: { employeeId: true },
      })
    )
  })

  // REQ-6.2 — employee employed at a DIFFERENT company → rejected
  it('REQ-6.2: rejects when employee has Employment only at a different company', async () => {
    // Employment query with companyId=COMPANY_ID returns empty
    prismaMock.employment.findMany.mockResolvedValue([])

    const result = await createAffiliation(createAffiliationPayload([EMPLOYEE_A]))

    expect(result.success).toBe(false)
    expect(result.error).toBe(
      'Uno o más empleados no son válidos o no pertenecen a esta empresa'
    )
  })

  // REQ-6.3 — only inactive Employment at the company → rejected
  it('REQ-6.3: rejects when employee has only inactive Employment at the company', async () => {
    // The query includes isActive:true so inactive rows are never returned
    prismaMock.employment.findMany.mockResolvedValue([])

    const result = await createAffiliation(createAffiliationPayload([EMPLOYEE_A]))

    expect(result.success).toBe(false)
    expect(result.error).toBe(
      'Uno o más empleados no son válidos o no pertenecen a esta empresa'
    )
  })

  // REQ-6.6 — validation uses Employment, NOT Client.companyId or Client.clientType
  it('REQ-6.6: passes regardless of Client.companyId shadow value or clientType', async () => {
    // Employment table has the row — that is the ONLY source of truth
    prismaMock.employment.findMany.mockResolvedValue([{ employeeId: EMPLOYEE_A }])

    const result = await createAffiliation(createAffiliationPayload([EMPLOYEE_A]))

    expect(result.success).toBe(true)
    // Critical: the old code called prisma.client.findMany with companyId + clientType:'EMPLEADO'.
    // The new code must NOT call prisma.client.findMany for membership validation.
    expect(prismaMock.client.findMany).not.toHaveBeenCalled()
  })

  // Multiple employees — partial match is rejected (Set size !== requested count)
  it('rejects when at least one employee lacks active Employment at the company', async () => {
    // Only EMPLOYEE_A is returned; EMPLOYEE_B is missing
    prismaMock.employment.findMany.mockResolvedValue([{ employeeId: EMPLOYEE_A }])

    const result = await createAffiliation(
      createAffiliationPayload([EMPLOYEE_A, EMPLOYEE_B])
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe(
      'Uno o más empleados no son válidos o no pertenecen a esta empresa'
    )
  })

  // All employees validly employed — multiple employees pass together
  it('creates affiliation when all employees have active Employment at the company', async () => {
    prismaMock.employment.findMany.mockResolvedValue([
      { employeeId: EMPLOYEE_A },
      { employeeId: EMPLOYEE_B },
    ])

    const result = await createAffiliation(
      createAffiliationPayload([EMPLOYEE_A, EMPLOYEE_B])
    )

    expect(result.success).toBe(true)
  })

  // Identity guard preserved: non-EMPRESA client still rejected before Employment check
  it('rejects non-EMPRESA client before the Employment query runs', async () => {
    // Override the client mock to return INDEPENDIENTE
    prismaMock.client.findUnique.mockResolvedValue({
      id: COMPANY_ID,
      clientType: ClientType.INDEPENDIENTE,
      isActive: true,
      fullName: 'Freelancer SA',
    })
    prismaMock.employment.findMany.mockResolvedValue([])

    const result = await createAffiliation(createAffiliationPayload([EMPLOYEE_A]))

    expect(result.success).toBe(false)
    expect(result.error).toBe(
      'Solo clientes tipo EMPRESA pueden tener empleados en sub-procesos'
    )
    // Employment query must not have been called
    expect(prismaMock.employment.findMany).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// REQ-6: addSubProcesses — Employment-based validation
// ---------------------------------------------------------------------------

describe('REQ-6 addSubProcesses: Employment-based employee validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupManagerSession()
    // Active affiliation with EMPRESA client
    prismaMock.affiliation.findUnique.mockResolvedValue({
      id: AFFIL_ID,
      clientId: COMPANY_ID,
      status: AffiliationStatus.ACTIVE,
      client: {
        id: COMPANY_ID,
        clientType: ClientType.EMPRESA,
        isActive: true,
        fullName: 'Test Company SA',
      },
    })
    // No managers in subProcesses → user.findMany not reached
    prismaMock.user.findMany.mockResolvedValue([])
    // Success path: $transaction returns a created subprocess list
    prismaMock.$transaction.mockResolvedValue([
      {
        id: 'csubprocess0001',
        affiliationId: AFFIL_ID,
        type: AffiliationSubProcessType.EPS,
        status: 'NOT_STARTED',
        assignedToId: null,
        employeeId: EMPLOYEE_A,
        statusReason: null,
        disabilityStartDate: null,
        disabilityEndDate: null,
        bankRegistry: false,
        transcription: false,
        collection: false,
        paidToUser: false,
        disabilityAdministradoraId: null,
        disabilityAdministradoraType: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
  })

  // REQ-6.4 — valid Employment at affiliation's company → subprocess created
  it('REQ-6.4: creates subprocess when employee has active Employment at affiliation company', async () => {
    prismaMock.employment.findMany.mockResolvedValue([{ employeeId: EMPLOYEE_A }])

    const result = await addSubProcesses(addSubProcessesPayload([EMPLOYEE_A]))

    expect(result.success).toBe(true)
    expect(prismaMock.employment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: COMPANY_ID,
          isActive: true,
          employeeId: { in: [EMPLOYEE_A] },
          employee: { isActive: true },
        }),
        select: { employeeId: true },
      })
    )
  })

  // REQ-6.5 — employee NOT at affiliation's company → rejected
  it('REQ-6.5: rejects subprocess when employee has no active Employment at affiliation company', async () => {
    prismaMock.employment.findMany.mockResolvedValue([])

    const result = await addSubProcesses(addSubProcessesPayload([EMPLOYEE_A]))

    expect(result.success).toBe(false)
    expect(result.error).toBe(
      'Uno o más empleados no son válidos o no pertenecen a esta empresa'
    )
  })

  // Uses affiliation.clientId as companyId (NOT a separate client lookup)
  it('queries Employment with companyId equal to affiliation.clientId', async () => {
    prismaMock.employment.findMany.mockResolvedValue([{ employeeId: EMPLOYEE_A }])

    await addSubProcesses(addSubProcessesPayload([EMPLOYEE_A]))

    const call = prismaMock.employment.findMany.mock.calls[0]?.[0]
    expect(call?.where?.companyId).toBe(COMPANY_ID)
    // Must not call prisma.client.findMany for membership validation
    expect(prismaMock.client.findMany).not.toHaveBeenCalled()
  })

  // Identity guard preserved: non-EMPRESA affiliation client still rejected
  it('rejects non-EMPRESA affiliation client before the Employment query runs', async () => {
    prismaMock.affiliation.findUnique.mockResolvedValue({
      id: AFFIL_ID,
      clientId: COMPANY_ID,
      status: AffiliationStatus.ACTIVE,
      client: {
        id: COMPANY_ID,
        clientType: ClientType.EMPLEADO,
        isActive: true,
        fullName: 'Single Employee',
      },
    })
    prismaMock.employment.findMany.mockResolvedValue([])

    const result = await addSubProcesses(addSubProcessesPayload([EMPLOYEE_A]))

    expect(result.success).toBe(false)
    expect(result.error).toBe(
      'Solo clientes tipo EMPRESA pueden tener empleados en sub-procesos'
    )
    expect(prismaMock.employment.findMany).not.toHaveBeenCalled()
  })
})
