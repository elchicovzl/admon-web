/**
 * employment.actions.test.ts
 *
 * Tests for Phase 2 employment-join-table backend core.
 * Covers:
 *   - createEmployment  (REQ-1: 1.1–1.7, REQ-2: 2.1–2.2)
 *   - deactivateEmployment (REQ-5: 5.1–5.4)
 *   - getAvailableEmployees (REQ-3: 3.1–3.6)
 *   - getCompanyEmployees   (REQ-4: 4.1–4.3)
 *
 * All enums use REAL Prisma values from @prisma/client.
 * NEVER: 'MEDIO_TIEMPO', 'PART_TIME', 'PERSONA', or numeric strings ('5', '3').
 *
 * IDs must pass z.string().cuid() → regex /^c[^\s-]{8,}$/i
 * (starts with 'c', at least 8 more chars, NO spaces or hyphens)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClientType, EmployeeType, WorkDaysRange, UserRole, IdentificationType } from '@prisma/client'

// ---------------------------------------------------------------------------
// Cuid-compliant test ID constants
// All IDs must match /^c[^\s-]{8,}$/i — no hyphens, starts with 'c', ≥9 chars
// ---------------------------------------------------------------------------

const ID = {
  COMPANY_X:  'ccompanyxxx0001',
  COMPANY_Y:  'ccompanyyy0001',
  COMPANY_Z:  'ccompanyzz0001',
  CLIENT_A:   'cclientaaaa0001',
  CLIENT_B:   'cclientbbbb0001',
  CLIENT_C:   'cclientcccc0001',
  CLIENT_D:   'cclientdddd0001',
  EMPRESA:    'cempresaxx0001',
  NON_EXIST:  'cnonexistxx0001',
  MANAGER:    'cmanagerxx0001',
} as const

// ---------------------------------------------------------------------------
// Hoisted mock objects — must be declared before vi.mock() calls
// ---------------------------------------------------------------------------

const { prismaMock, authMock } = vi.hoisted(() => {
  const clientMock = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  }
  const employmentMock = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  }
  return {
    prismaMock: { client: clientMock, employment: employmentMock },
    authMock: vi.fn(),
  }
})

// ---------------------------------------------------------------------------
// Module mocks (hoisted by Vitest transformer)
// ---------------------------------------------------------------------------

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/auth/auth', () => ({ auth: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('react', () => ({
  cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}))

// ---------------------------------------------------------------------------
// Imports under test (AFTER vi.mock() calls so mocks are wired first)
// ---------------------------------------------------------------------------

import { createEmployment, deactivateEmployment } from '../employment.actions'
import { getAvailableEmployees, getCompanyEmployees } from '../client.actions'

// ---------------------------------------------------------------------------
// Shared test session
// ---------------------------------------------------------------------------

const MANAGER_SESSION = {
  user: {
    id: ID.MANAGER,
    name: 'Manager',
    email: 'manager@test.com',
    image: null,
    role: UserRole.MANAGER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  expires: new Date(Date.now() + 3_600_000).toISOString(),
}

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeClient(overrides: {
  id: string
  clientType?: ClientType
  companyId?: string | null
  isActive?: boolean
}) {
  return {
    id: overrides.id,
    fullName: `Client ${overrides.id}`,
    identificationType: IdentificationType.CEDULA,
    identificationNumber: '1234567890',
    clientType: overrides.clientType ?? ClientType.EMPLEADO,
    employeeType: null,
    workDaysRange: null,
    email: `${overrides.id.slice(0, 8)}@test.com`,
    phone: '3001234567',
    status: 'ACTIVO',
    isActive: overrides.isActive ?? true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    companyId: overrides.companyId ?? null,
  }
}

function makeEmployment(overrides: {
  employeeId: string
  companyId: string
  isActive?: boolean
  employeeType?: EmployeeType | null
  workDaysRange?: WorkDaysRange | null
}) {
  return {
    id: `cempremp${overrides.employeeId.slice(0, 4)}001`,
    employeeId: overrides.employeeId,
    companyId: overrides.companyId,
    employeeType: overrides.employeeType ?? null,
    workDaysRange: overrides.workDaysRange ?? null,
    startDate: new Date('2024-01-01'),
    isActive: overrides.isActive ?? true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authorizeAsManager() {
  authMock.mockResolvedValue(MANAGER_SESSION)
}

function resetMocks() {
  prismaMock.client.findUnique.mockReset()
  prismaMock.client.findMany.mockReset()
  prismaMock.client.update.mockReset()
  prismaMock.employment.findUnique.mockReset()
  prismaMock.employment.findMany.mockReset()
  prismaMock.employment.upsert.mockReset()
  prismaMock.employment.update.mockReset()
  authMock.mockReset()
}

beforeEach(() => {
  resetMocks()
})

// ===========================================================================
// createEmployment — REQ-1 (1.1–1.7)
// ===========================================================================

describe('createEmployment', () => {
  // -------------------------------------------------------------------------
  // REQ-1.1 — Happy path
  // Spec note: scenario uses 'PERSONA' clientType (not real).
  // Corrected: uses INDEPENDIENTE (real ClientType with no employment restriction).
  // -------------------------------------------------------------------------
  it('REQ-1.1: creates Employment row for a valid employeeId + companyId pair', async () => {
    authorizeAsManager()

    const company  = makeClient({ id: ID.COMPANY_X, clientType: ClientType.EMPRESA })
    const employee = makeClient({ id: ID.CLIENT_A,  clientType: ClientType.INDEPENDIENTE })
    const created  = makeEmployment({
      employeeId: ID.CLIENT_A,
      companyId:  ID.COMPANY_X,
      employeeType:  EmployeeType.TIEMPO_COMPLETO,
      workDaysRange: WorkDaysRange.DIAS_1_7,
    })

    prismaMock.client.findUnique
      .mockResolvedValueOnce(company)   // company lookup
      .mockResolvedValueOnce(employee)  // employee lookup
    prismaMock.employment.findUnique.mockResolvedValueOnce(null) // no existing row
    prismaMock.employment.upsert.mockResolvedValueOnce(created)

    const result = await createEmployment({
      employeeId:    ID.CLIENT_A,
      companyId:     ID.COMPANY_X,
      employeeType:  EmployeeType.TIEMPO_COMPLETO,
      workDaysRange: WorkDaysRange.DIAS_1_7,
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data!.employeeId).toBe(ID.CLIENT_A)
    expect(result.data!.companyId).toBe(ID.COMPANY_X)
    expect(result.data!.isActive).toBe(true)
    // Phase 3: no legacy shadow write to Client.companyId
    expect(prismaMock.client.update).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // REQ-1.2 — EMPLEADO clientType can be assigned
  // Spec note: scenario uses 'MEDIO_TIEMPO' and workDaysRange '3' — corrected.
  // -------------------------------------------------------------------------
  it('REQ-1.2: EMPLEADO-type client can be assigned; clientType is preserved in DB', async () => {
    authorizeAsManager()

    const company  = makeClient({ id: ID.COMPANY_X, clientType: ClientType.EMPRESA })
    const employee = makeClient({ id: ID.CLIENT_B,  clientType: ClientType.EMPLEADO })
    const created  = makeEmployment({
      employeeId:    ID.CLIENT_B,
      companyId:     ID.COMPANY_X,
      employeeType:  EmployeeType.TIEMPO_PARCIAL,
      workDaysRange: WorkDaysRange.DIAS_8_14,
    })

    prismaMock.client.findUnique
      .mockResolvedValueOnce(company)
      .mockResolvedValueOnce(employee)
    prismaMock.employment.findUnique.mockResolvedValueOnce(null)
    prismaMock.employment.upsert.mockResolvedValueOnce(created)
    const result = await createEmployment({
      employeeId:    ID.CLIENT_B,
      companyId:     ID.COMPANY_X,
      employeeType:  EmployeeType.TIEMPO_PARCIAL,
      workDaysRange: WorkDaysRange.DIAS_8_14,
    })

    expect(result.success).toBe(true)
    expect(result.data!.employeeType).toBe(EmployeeType.TIEMPO_PARCIAL)
  })

  // -------------------------------------------------------------------------
  // REQ-1.3 — Reject duplicate active employment
  // -------------------------------------------------------------------------
  it('REQ-1.3: rejects when an active Employment already exists for the same pair', async () => {
    authorizeAsManager()

    const company        = makeClient({ id: ID.COMPANY_X, clientType: ClientType.EMPRESA })
    const employee       = makeClient({ id: ID.CLIENT_A,  clientType: ClientType.EMPLEADO })
    const existingActive = makeEmployment({ employeeId: ID.CLIENT_A, companyId: ID.COMPANY_X, isActive: true })

    prismaMock.client.findUnique
      .mockResolvedValueOnce(company)
      .mockResolvedValueOnce(employee)
    prismaMock.employment.findUnique.mockResolvedValueOnce(existingActive)

    const result = await createEmployment({
      employeeId:   ID.CLIENT_A,
      companyId:    ID.COMPANY_X,
      employeeType: EmployeeType.TIEMPO_COMPLETO,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Este cliente ya está activamente empleado en esta empresa')
    expect(prismaMock.employment.upsert).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // REQ-1.4 — Reject self-employment
  // -------------------------------------------------------------------------
  it('REQ-1.4: rejects when employeeId === companyId (self-employment)', async () => {
    authorizeAsManager()

    const result = await createEmployment({
      employeeId:   ID.COMPANY_X,
      companyId:    ID.COMPANY_X,
      employeeType: EmployeeType.TIEMPO_COMPLETO,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Un cliente no puede ser empleado de sí mismo')
    expect(prismaMock.client.findUnique).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // REQ-1.5 — Reject when company does not exist
  // -------------------------------------------------------------------------
  it('REQ-1.5: rejects when companyId does not resolve to an existing client', async () => {
    authorizeAsManager()

    prismaMock.client.findUnique.mockResolvedValueOnce(null) // company not found

    const result = await createEmployment({
      employeeId: ID.CLIENT_A,
      companyId:  ID.NON_EXIST,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Empresa no encontrada')
  })

  // -------------------------------------------------------------------------
  // REQ-1.6 — Optional employeeType: undefined is accepted
  // Spec note: original scenario used workDaysRange:'5' (not a real enum value).
  // Corrected: both employeeType and workDaysRange undefined is valid per schema
  // (both fields are optional().nullable()), so the Employment is created.
  // -------------------------------------------------------------------------
  it('REQ-1.6: undefined employeeType is accepted because schema field is optional/nullable', async () => {
    authorizeAsManager()

    const company  = makeClient({ id: ID.COMPANY_X, clientType: ClientType.EMPRESA })
    const employee = makeClient({ id: ID.CLIENT_A,  clientType: ClientType.EMPLEADO })
    const created  = makeEmployment({ employeeId: ID.CLIENT_A, companyId: ID.COMPANY_X, employeeType: null })

    prismaMock.client.findUnique
      .mockResolvedValueOnce(company)
      .mockResolvedValueOnce(employee)
    prismaMock.employment.findUnique.mockResolvedValueOnce(null)
    prismaMock.employment.upsert.mockResolvedValueOnce(created)
    const result = await createEmployment({
      employeeId:    ID.CLIENT_A,
      companyId:     ID.COMPANY_X,
      employeeType:  undefined,
      workDaysRange: undefined,
    })

    expect(result.success).toBe(true)
    expect(result.data!.employeeType).toBeNull()
  })

  // -------------------------------------------------------------------------
  // REQ-1.7 — Re-hire: reactivate an inactive Employment via upsert
  // -------------------------------------------------------------------------
  it('REQ-1.7: reactivates an inactive Employment (re-hire) via upsert — no duplicate row', async () => {
    authorizeAsManager()

    const company    = makeClient({ id: ID.COMPANY_X, clientType: ClientType.EMPRESA })
    const employee   = makeClient({ id: ID.CLIENT_A,  clientType: ClientType.EMPLEADO })
    const inactive   = makeEmployment({ employeeId: ID.CLIENT_A, companyId: ID.COMPANY_X, isActive: false })
    const reactivated = { ...inactive, isActive: true, employeeType: EmployeeType.TIEMPO_COMPLETO }

    prismaMock.client.findUnique
      .mockResolvedValueOnce(company)
      .mockResolvedValueOnce(employee)
    prismaMock.employment.findUnique.mockResolvedValueOnce(inactive) // isActive=false → allow
    prismaMock.employment.upsert.mockResolvedValueOnce(reactivated)
    const result = await createEmployment({
      employeeId:    ID.CLIENT_A,
      companyId:     ID.COMPANY_X,
      employeeType:  EmployeeType.TIEMPO_COMPLETO,
      workDaysRange: WorkDaysRange.DIAS_1_7,
    })

    expect(result.success).toBe(true)
    expect(result.data!.isActive).toBe(true)
    expect(prismaMock.employment.upsert).toHaveBeenCalledOnce()
  })
})

// ===========================================================================
// REQ-2 — Multi-employer support
// ===========================================================================

describe('createEmployment — REQ-2 multi-employer', () => {
  // -------------------------------------------------------------------------
  // REQ-2.1 — Client already employed at A can be employed at B
  // -------------------------------------------------------------------------
  it('REQ-2.1: allows creating a second active Employment at a different company', async () => {
    authorizeAsManager()

    const companyY   = makeClient({ id: ID.COMPANY_Y, clientType: ClientType.EMPRESA })
    const employee   = makeClient({ id: ID.CLIENT_A,  clientType: ClientType.EMPLEADO })
    const newEmp     = makeEmployment({
      employeeId:    ID.CLIENT_A,
      companyId:     ID.COMPANY_Y,
      employeeType:  EmployeeType.TIEMPO_COMPLETO,
      workDaysRange: WorkDaysRange.DIAS_1_7,
    })

    prismaMock.client.findUnique
      .mockResolvedValueOnce(companyY)
      .mockResolvedValueOnce(employee)
    prismaMock.employment.findUnique.mockResolvedValueOnce(null) // no existing at companyY
    prismaMock.employment.upsert.mockResolvedValueOnce(newEmp)
    const result = await createEmployment({
      employeeId:    ID.CLIENT_A,
      companyId:     ID.COMPANY_Y,
      employeeType:  EmployeeType.TIEMPO_COMPLETO,
      workDaysRange: WorkDaysRange.DIAS_1_7,
    })

    expect(result.success).toBe(true)
    expect(result.data!.companyId).toBe(ID.COMPANY_Y)
  })

  // -------------------------------------------------------------------------
  // REQ-2.2 — EMPRESA-type client can also be an employee elsewhere
  // -------------------------------------------------------------------------
  it('REQ-2.2: EMPRESA-type client can be an employee at another company', async () => {
    authorizeAsManager()

    const companyZ   = makeClient({ id: ID.COMPANY_Z, clientType: ClientType.EMPRESA })
    const empresaEmp = makeClient({ id: ID.EMPRESA,   clientType: ClientType.EMPRESA })
    const created    = makeEmployment({
      employeeId:   ID.EMPRESA,
      companyId:    ID.COMPANY_Z,
      employeeType: EmployeeType.INDEPENDIENTE_CONTRATISTA,
    })

    prismaMock.client.findUnique
      .mockResolvedValueOnce(companyZ)
      .mockResolvedValueOnce(empresaEmp)
    prismaMock.employment.findUnique.mockResolvedValueOnce(null)
    prismaMock.employment.upsert.mockResolvedValueOnce(created)
    const result = await createEmployment({
      employeeId:   ID.EMPRESA,
      companyId:    ID.COMPANY_Z,
      employeeType: EmployeeType.INDEPENDIENTE_CONTRATISTA,
    })

    expect(result.success).toBe(true)
    expect(result.data!.employeeType).toBe(EmployeeType.INDEPENDIENTE_CONTRATISTA)
  })
})

// ===========================================================================
// deactivateEmployment — REQ-5
// ===========================================================================

describe('deactivateEmployment', () => {
  // -------------------------------------------------------------------------
  // REQ-5.1 — Happy path: deactivate an active Employment
  // -------------------------------------------------------------------------
  it('REQ-5.1: sets isActive=false for an active Employment and returns success', async () => {
    authorizeAsManager()

    const activeEmp = makeEmployment({ employeeId: ID.CLIENT_A, companyId: ID.COMPANY_X, isActive: true })
    const updated   = { ...activeEmp, isActive: false }

    prismaMock.employment.findUnique.mockResolvedValueOnce(activeEmp)
    prismaMock.employment.update.mockResolvedValueOnce(updated)

    const result = await deactivateEmployment({ employeeId: ID.CLIENT_A, companyId: ID.COMPANY_X })

    expect(result.success).toBe(true)
    expect(prismaMock.employment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } })
    )
    // Phase 3: no legacy shadow clear on Client.companyId
    expect(prismaMock.client.update).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // REQ-5.2 — Reject when Employment does not exist
  // -------------------------------------------------------------------------
  it('REQ-5.2: returns "Relación de empleo no encontrada" when no Employment row exists', async () => {
    authorizeAsManager()

    prismaMock.employment.findUnique.mockResolvedValueOnce(null)

    const result = await deactivateEmployment({ employeeId: ID.CLIENT_A, companyId: ID.COMPANY_X })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Relación de empleo no encontrada')
    expect(prismaMock.employment.update).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // REQ-5.3 — Reject when Employment is already inactive
  // -------------------------------------------------------------------------
  it('REQ-5.3: returns error when Employment is already inactive', async () => {
    authorizeAsManager()

    const inactiveEmp = makeEmployment({ employeeId: ID.CLIENT_A, companyId: ID.COMPANY_X, isActive: false })
    prismaMock.employment.findUnique.mockResolvedValueOnce(inactiveEmp)

    const result = await deactivateEmployment({ employeeId: ID.CLIENT_A, companyId: ID.COMPANY_X })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Esta relación de empleo ya se encuentra inactiva')
    expect(prismaMock.employment.update).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // REQ-5.4 — Deactivating one Employment does not affect others of the same client
  // (enforced by the WHERE clause scoping update to the specific unique key)
  // -------------------------------------------------------------------------
  it('REQ-5.4: deactivates only the specific (employeeId, companyId) pair', async () => {
    authorizeAsManager()

    const empAtX = makeEmployment({ employeeId: ID.CLIENT_A, companyId: ID.COMPANY_X, isActive: true })

    prismaMock.employment.findUnique.mockResolvedValueOnce(empAtX)
    prismaMock.employment.update.mockResolvedValueOnce({ ...empAtX, isActive: false })

    const result = await deactivateEmployment({ employeeId: ID.CLIENT_A, companyId: ID.COMPANY_X })

    expect(result.success).toBe(true)
    // update scoped to exact pair — other employments of clientA are untouched
    expect(prismaMock.employment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { employeeId_companyId: { employeeId: ID.CLIENT_A, companyId: ID.COMPANY_X } },
      })
    )
  })
})

// ===========================================================================
// getAvailableEmployees — REQ-3
// ===========================================================================

describe('getAvailableEmployees', () => {
  // -------------------------------------------------------------------------
  // REQ-3.1 — Excludes clients already actively employed at target company
  // -------------------------------------------------------------------------
  it('REQ-3.1: query WHERE excludes clients with active Employment at the target company', async () => {
    authorizeAsManager()

    const clientB = makeClient({ id: ID.CLIENT_B })
    prismaMock.client.findMany.mockResolvedValueOnce([clientB])

    const result = await getAvailableEmployees(ID.COMPANY_X)

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(result.data![0].id).toBe(ID.CLIENT_B)

    // Verify the NOT filter targets THIS company's active employments
    expect(prismaMock.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          id: { not: ID.COMPANY_X },
          NOT: { employmentsAsEmployee: { some: { companyId: ID.COMPANY_X, isActive: true } } },
        }),
      })
    )
  })

  // -------------------------------------------------------------------------
  // REQ-3.2 — Includes clients employed at OTHER companies (multi-employer)
  // -------------------------------------------------------------------------
  it('REQ-3.2: includes clients already employed at a DIFFERENT company', async () => {
    authorizeAsManager()

    // clientA is employed at companyY — should appear as available for companyX
    const clientA = makeClient({ id: ID.CLIENT_A, companyId: ID.COMPANY_Y })
    prismaMock.client.findMany.mockResolvedValueOnce([clientA])

    const result = await getAvailableEmployees(ID.COMPANY_X)

    expect(result.success).toBe(true)
    expect(result.data!.some((c) => c.id === ID.CLIENT_A)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // REQ-3.3 — EMPRESA-type clients appear as candidates
  // -------------------------------------------------------------------------
  it('REQ-3.3: EMPRESA-type clients are included in available candidates', async () => {
    authorizeAsManager()

    const empresa = makeClient({ id: ID.EMPRESA, clientType: ClientType.EMPRESA })
    prismaMock.client.findMany.mockResolvedValueOnce([empresa])

    const result = await getAvailableEmployees(ID.COMPANY_X)

    expect(result.success).toBe(true)
    expect(result.data!.some((c) => c.clientType === ClientType.EMPRESA)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // REQ-3.4 — EMPLEADO with non-null companyId shadow is still available
  // -------------------------------------------------------------------------
  it('REQ-3.4: EMPLEADO-type client with legacy companyId shadow is still available for target', async () => {
    authorizeAsManager()

    // clientC has companyId=companyY in shadow — old query excluded them; new query doesn't
    const clientC = makeClient({ id: ID.CLIENT_C, clientType: ClientType.EMPLEADO, companyId: ID.COMPANY_Y })
    prismaMock.client.findMany.mockResolvedValueOnce([clientC])

    const result = await getAvailableEmployees(ID.COMPANY_X)

    expect(result.success).toBe(true)
    expect(result.data!.some((c) => c.id === ID.CLIENT_C)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // REQ-3.5 — Excludes the target company itself
  // -------------------------------------------------------------------------
  it('REQ-3.5: WHERE clause excludes the target company itself (id: { not: companyId })', async () => {
    authorizeAsManager()

    prismaMock.client.findMany.mockResolvedValueOnce([])

    const result = await getAvailableEmployees(ID.COMPANY_X)

    expect(result.success).toBe(true)
    expect(prismaMock.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: ID.COMPANY_X },
        }),
      })
    )
  })

  // -------------------------------------------------------------------------
  // REQ-3.6 — Clients with INACTIVE Employment at target are included
  // -------------------------------------------------------------------------
  it('REQ-3.6: clients with only inactive Employment at target are included (re-hire eligible)', async () => {
    authorizeAsManager()

    const clientD = makeClient({ id: ID.CLIENT_D })
    // NOT filter uses isActive:true — so inactive employment doesn't block re-assignment
    prismaMock.client.findMany.mockResolvedValueOnce([clientD])

    const result = await getAvailableEmployees(ID.COMPANY_X)

    expect(result.success).toBe(true)
    expect(result.data!.some((c) => c.id === ID.CLIENT_D)).toBe(true)
    expect(prismaMock.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: { employmentsAsEmployee: { some: { companyId: ID.COMPANY_X, isActive: true } } },
        }),
      })
    )
  })
})

// ===========================================================================
// getCompanyEmployees — REQ-4
// ===========================================================================

describe('getCompanyEmployees', () => {
  // -------------------------------------------------------------------------
  // REQ-4.1 — Returns active employees with per-Employment role fields
  // Spec note: scenario uses 'MEDIO_TIEMPO'/'PART_TIME' and '3'/'5' — corrected.
  // -------------------------------------------------------------------------
  it('REQ-4.1: returns only active Employment rows with per-employment role fields', async () => {
    authorizeAsManager()

    const company = makeClient({ id: ID.COMPANY_X, clientType: ClientType.EMPRESA })
    const rowA = {
      employeeType:  EmployeeType.TIEMPO_COMPLETO,
      workDaysRange: WorkDaysRange.DIAS_1_7,
      startDate: new Date('2024-01-01'),
      employee: { ...makeClient({ id: ID.CLIENT_A }), isActive: true },
    }
    const rowB = {
      employeeType:  EmployeeType.TIEMPO_PARCIAL,
      workDaysRange: WorkDaysRange.DIAS_8_14,
      startDate: new Date('2024-02-01'),
      employee: { ...makeClient({ id: ID.CLIENT_B }), isActive: true },
    }

    prismaMock.client.findUnique.mockResolvedValueOnce(company)
    prismaMock.employment.findMany.mockResolvedValueOnce([rowA, rowB])

    const result = await getCompanyEmployees(ID.COMPANY_X)

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
    expect(result.data!.some((e) => e.id === ID.CLIENT_A)).toBe(true)
    expect(result.data!.some((e) => e.id === ID.CLIENT_B)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // REQ-4.2 — Returns empty array for company with no active employees
  // -------------------------------------------------------------------------
  it('REQ-4.2: returns empty array when company has no active Employments', async () => {
    authorizeAsManager()

    const company = makeClient({ id: ID.COMPANY_X, clientType: ClientType.EMPRESA })
    prismaMock.client.findUnique.mockResolvedValueOnce(company)
    prismaMock.employment.findMany.mockResolvedValueOnce([])

    const result = await getCompanyEmployees(ID.COMPANY_X)

    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
  })

  // -------------------------------------------------------------------------
  // REQ-4.3 — employeeType and workDaysRange come from Employment, NOT Client shadow
  // Spec note: scenario uses 'PART_TIME' as client shadow — corrected to TIEMPO_PARCIAL.
  // The test confirms Employment.employeeType (TIEMPO_COMPLETO) is what's returned.
  // -------------------------------------------------------------------------
  it('REQ-4.3: employeeType from Employment row is returned, not from any Client shadow value', async () => {
    authorizeAsManager()

    const company = makeClient({ id: ID.COMPANY_X, clientType: ClientType.EMPRESA })
    // The employment row carries TIEMPO_COMPLETO — this is what getCompanyEmployees should return
    const row = {
      employeeType:  EmployeeType.TIEMPO_COMPLETO,  // from Employment table
      workDaysRange: WorkDaysRange.DIAS_22_30,       // from Employment table
      startDate: new Date('2024-01-01'),
      employee: {
        // select does NOT include client.employeeType — role comes from Employment only
        id:                   ID.CLIENT_A,
        fullName:             'Client A',
        identificationType:   IdentificationType.CEDULA,
        identificationNumber: '1234567890',
        clientType:           ClientType.EMPLEADO,
        email:                'clienta@test.com',
        phone:                '3001234567',
        status:               'ACTIVO',
        isActive:             true,
        createdAt:            new Date('2024-01-01'),
        updatedAt:            new Date('2024-01-01'),
      },
    }

    prismaMock.client.findUnique.mockResolvedValueOnce(company)
    prismaMock.employment.findMany.mockResolvedValueOnce([row])

    const result = await getCompanyEmployees(ID.COMPANY_X)

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(result.data![0].id).toBe(ID.CLIENT_A)
    // employeeType sourced from Employment (TIEMPO_COMPLETO), not from any client shadow
    expect(result.data![0].employeeType).toBe(EmployeeType.TIEMPO_COMPLETO)
    expect(result.data![0].workDaysRange).toBe(WorkDaysRange.DIAS_22_30)
  })

  // -------------------------------------------------------------------------
  // Additional: inactive client employees are filtered out (even with isActive Employment)
  // -------------------------------------------------------------------------
  it('filters out employees whose Client record has isActive=false', async () => {
    authorizeAsManager()

    const company = makeClient({ id: ID.COMPANY_X, clientType: ClientType.EMPRESA })
    const rowInactive = {
      employeeType:  EmployeeType.TIEMPO_COMPLETO,
      workDaysRange: WorkDaysRange.DIAS_1_7,
      startDate: new Date('2024-01-01'),
      employee: {
        id:                   ID.CLIENT_C,
        fullName:             'Inactive Client',
        identificationType:   IdentificationType.CEDULA,
        identificationNumber: '9876543210',
        clientType:           ClientType.EMPLEADO,
        email:                'inactive@test.com',
        phone:                '3009876543',
        status:               'INACTIVO',
        isActive:             false,  // client is deactivated
        createdAt:            new Date('2024-01-01'),
        updatedAt:            new Date('2024-01-01'),
      },
    }

    prismaMock.client.findUnique.mockResolvedValueOnce(company)
    prismaMock.employment.findMany.mockResolvedValueOnce([rowInactive])

    const result = await getCompanyEmployees(ID.COMPANY_X)

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // Guard: non-EMPRESA company is rejected
  // -------------------------------------------------------------------------
  it('returns error when target is not an EMPRESA-type client', async () => {
    authorizeAsManager()

    const nonCompany = makeClient({ id: ID.CLIENT_A, clientType: ClientType.EMPLEADO })
    prismaMock.client.findUnique.mockResolvedValueOnce(nonCompany)

    const result = await getCompanyEmployees(ID.CLIENT_A)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Solo clientes tipo EMPRESA pueden tener empleados')
  })
})
