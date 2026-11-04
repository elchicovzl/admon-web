import { describe, expect, it } from 'vitest'
import { AffiliationSubProcessType } from '@prisma/client'
import type { AffiliationWithRelations } from '@/lib/types/affiliation.types'
import {
  buildDisabilityRows,
  daysSince,
  disabilityDays,
  isDisabilityOnlyFilter,
} from '../disability-rows'

function sp(id: string, type: AffiliationSubProcessType, employee?: { id: string; fullName: string; identificationNumber?: string }) {
  return {
    id,
    affiliationId: 'aff',
    type,
    status: 'NOT_STARTED',
    assignedToId: null,
    employeeId: employee?.id ?? null,
    statusReason: null,
    disabilityStartDate: null,
    disabilityEndDate: null,
    bankRegistry: false,
    transcription: false,
    collection: false,
    paidToUser: false,
    disabilityAdministradoraId: null,
    disabilityAdministradoraType: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    employee: employee ?? null,
  }
}

function aff(id: string, number: string, clientName: string, subProcesses: ReturnType<typeof sp>[]) {
  return {
    id,
    affiliationNumber: number,
    client: { id: `c-${id}`, fullName: clientName, identificationNumber: `id-${id}` },
    subProcesses,
  } as unknown as AffiliationWithRelations
}

const { INCAPACIDADES, EPS, ARL } = AffiliationSubProcessType

describe('isDisabilityOnlyFilter', () => {
  it('is true only when INCAPACIDADES is the single selected sub-process type', () => {
    expect(isDisabilityOnlyFilter([INCAPACIDADES])).toBe(true)
    expect(isDisabilityOnlyFilter([])).toBe(false)
    expect(isDisabilityOnlyFilter([EPS])).toBe(false)
    expect(isDisabilityOnlyFilter([INCAPACIDADES, EPS])).toBe(false)
  })
})

describe('buildDisabilityRows', () => {
  const a1 = aff('a1', 'AF-1', 'Empresa Uno', [
    sp('s1', INCAPACIDADES, { id: 'e1', fullName: 'Ana Pérez', identificationNumber: '111' }),
    sp('s2', EPS),
    sp('s3', INCAPACIDADES, { id: 'e2', fullName: 'Luis Gómez', identificationNumber: '222' }),
  ])
  const a2 = aff('a2', 'AF-2', 'Cliente Dos', [sp('s4', ARL)])

  it('returns one row per INCAPACIDADES sub-process, keeping its affiliation', () => {
    const rows = buildDisabilityRows([a1, a2], '')
    expect(rows.map((r) => r.subProcess.id)).toEqual(['s1', 's3'])
    expect(rows.every((r) => r.affiliation.id === 'a1')).toBe(true)
  })

  it('keeps every disability row when the query matches the affiliation itself', () => {
    expect(buildDisabilityRows([a1], 'af-1').map((r) => r.subProcess.id)).toEqual(['s1', 's3'])
    expect(buildDisabilityRows([a1], 'empresa').map((r) => r.subProcess.id)).toEqual(['s1', 's3'])
  })

  it('keeps only the matching employee rows when the query matches an employee', () => {
    expect(buildDisabilityRows([a1], 'luis').map((r) => r.subProcess.id)).toEqual(['s3'])
    expect(buildDisabilityRows([a1], '111').map((r) => r.subProcess.id)).toEqual(['s1'])
  })
})

describe('disabilityDays', () => {
  it('counts both ends inclusive', () => {
    expect(disabilityDays('2026-10-26', '2026-11-04')).toBe(10)
    expect(disabilityDays('2026-10-26', '2026-10-26')).toBe(1)
  })

  it('returns null when a date is missing', () => {
    expect(disabilityDays(null, '2026-11-04')).toBeNull()
    expect(disabilityDays('2026-10-26', undefined)).toBeNull()
  })
})

describe('daysSince', () => {
  it('returns calendar days elapsed, never negative', () => {
    const now = new Date('2026-11-03T12:00:00')
    expect(daysSince('2026-10-29T08:00:00', now)).toBe(5)
    expect(daysSince('2026-12-01', now)).toBe(0)
    expect(daysSince(null, now)).toBeNull()
  })
})
