import { describe, it, expect } from 'vitest'
import { ClientType, EmployeeType, IdentificationType } from '@prisma/client'
import { createClientSchema, createEmployeeSchema } from '../client.schema'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function buildClientPayload(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'Juan Pérez García',
    clientTypes: [ClientType.INDEPENDIENTE],
    identificationType: IdentificationType.CEDULA,
    identificationNumber: '1234567890',
    email: 'juan@test.com',
    phone: '3001234567',
    ...overrides,
  }
}

function buildLegalRepresentative(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'Representante Legal',
    identificationType: IdentificationType.CEDULA,
    identificationNumber: '9876543210',
    ...overrides,
  }
}

// -----------------------------------------------------------------------------
// createClientSchema — clientTypes
// -----------------------------------------------------------------------------

describe('createClientSchema — clientTypes', () => {
  it('rejects an empty clientTypes array (at least one type required)', () => {
    const result = createClientSchema.safeParse(buildClientPayload({ clientTypes: [] }))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe('Selecciona al menos un tipo')
    }
  })

  it('accepts a client with several types at once', () => {
    const result = createClientSchema.safeParse(
      buildClientPayload({
        clientTypes: [ClientType.EMPLEADO, ClientType.INDEPENDIENTE],
      })
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.clientTypes).toEqual([ClientType.EMPLEADO, ClientType.INDEPENDIENTE])
    }
  })

  it('dedupes repeated types', () => {
    const result = createClientSchema.safeParse(
      buildClientPayload({
        clientTypes: [ClientType.EMPLEADO, ClientType.EMPLEADO, ClientType.INDEPENDIENTE],
      })
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.clientTypes).toEqual([ClientType.EMPLEADO, ClientType.INDEPENDIENTE])
    }
  })

  it('rejects an invalid enum value inside the array', () => {
    const result = createClientSchema.safeParse(
      buildClientPayload({ clientTypes: ['NOT_A_TYPE'] })
    )

    expect(result.success).toBe(false)
  })
})

// -----------------------------------------------------------------------------
// createClientSchema — EMPRESA refine
// -----------------------------------------------------------------------------

describe('createClientSchema — EMPRESA requires legalRepresentative', () => {
  it('rejects EMPRESA without a legal representative', () => {
    const result = createClientSchema.safeParse(
      buildClientPayload({ clientTypes: [ClientType.EMPRESA] })
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.errors.find((e) => e.path.includes('legalRepresentative'))
      expect(issue?.message).toBe('El representante legal es requerido para empresas')
    }
  })

  it('accepts EMPRESA with a legal representative', () => {
    const result = createClientSchema.safeParse(
      buildClientPayload({
        clientTypes: [ClientType.EMPRESA],
        legalRepresentative: buildLegalRepresentative(),
      })
    )

    expect(result.success).toBe(true)
  })

  it('requires a legal representative even when EMPRESA is combined with other types', () => {
    const result = createClientSchema.safeParse(
      buildClientPayload({ clientTypes: [ClientType.EMPLEADO, ClientType.EMPRESA] })
    )

    expect(result.success).toBe(false)
  })

  it('does not require a legal representative when EMPRESA is absent', () => {
    const result = createClientSchema.safeParse(
      buildClientPayload({ clientTypes: [ClientType.EMPLEADO, ClientType.INDEPENDIENTE] })
    )

    expect(result.success).toBe(true)
  })
})

// -----------------------------------------------------------------------------
// createClientSchema — EMPLEADO refine (workDaysRange for TIEMPO_PARCIAL)
// -----------------------------------------------------------------------------

describe('createClientSchema — EMPLEADO requires workDaysRange for TIEMPO_PARCIAL', () => {
  it('rejects TIEMPO_PARCIAL without workDaysRange when types include EMPLEADO', () => {
    const result = createClientSchema.safeParse(
      buildClientPayload({
        clientTypes: [ClientType.EMPLEADO],
        employeeType: EmployeeType.TIEMPO_PARCIAL,
      })
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.errors.find((e) => e.path.includes('workDaysRange'))
      expect(issue?.message).toBe('Los días laborados son requeridos para tiempo parcial')
    }
  })

  it('accepts TIEMPO_PARCIAL with workDaysRange when types include EMPLEADO', () => {
    const result = createClientSchema.safeParse(
      buildClientPayload({
        clientTypes: [ClientType.EMPLEADO],
        employeeType: EmployeeType.TIEMPO_PARCIAL,
        workDaysRange: 'DIAS_1_7',
      })
    )

    expect(result.success).toBe(true)
  })

  it('does not require workDaysRange when EMPLEADO is not among the types', () => {
    const result = createClientSchema.safeParse(
      buildClientPayload({
        clientTypes: [ClientType.INDEPENDIENTE],
        employeeType: EmployeeType.TIEMPO_PARCIAL,
      })
    )

    expect(result.success).toBe(true)
  })
})

// -----------------------------------------------------------------------------
// createEmployeeSchema — hardcoded to [EMPLEADO]
// -----------------------------------------------------------------------------

describe('createEmployeeSchema — clientTypes is always [EMPLEADO]', () => {
  it('defaults clientTypes to [EMPLEADO] when omitted', () => {
    const result = createEmployeeSchema.safeParse({
      fullName: 'Empleado Nuevo',
      identificationType: IdentificationType.CEDULA,
      identificationNumber: '1122334455',
      email: 'empleado@test.com',
      phone: '3009998877',
      employeeType: EmployeeType.TIEMPO_COMPLETO,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.clientTypes).toEqual([ClientType.EMPLEADO])
    }
  })

  it('ignores any other clientTypes passed in and forces [EMPLEADO]', () => {
    const result = createEmployeeSchema.safeParse({
      fullName: 'Empleado Nuevo',
      clientTypes: [ClientType.EMPRESA, ClientType.INDEPENDIENTE],
      identificationType: IdentificationType.CEDULA,
      identificationNumber: '1122334455',
      email: 'empleado@test.com',
      phone: '3009998877',
      employeeType: EmployeeType.TIEMPO_COMPLETO,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.clientTypes).toEqual([ClientType.EMPLEADO])
    }
  })
})
