import { describe, it, expect } from 'vitest'
import { filterEmployeesByQuery, normalizeSearchText } from '../employee-search'

const employees = [
  { id: '1', fullName: 'José Ángel Pérez', identificationNumber: '1001' },
  { id: '2', fullName: 'María López', identificationNumber: '2002' },
  { id: '3', fullName: 'Ana Gómez', identificationNumber: '10020' },
]

describe('normalizeSearchText', () => {
  it('strips accents, lowercases and trims', () => {
    expect(normalizeSearchText('  ÁNGEL Pérez ')).toBe('angel perez')
  })
})

describe('filterEmployeesByQuery', () => {
  it('returns everything for a blank query', () => {
    expect(filterEmployeesByQuery(employees, '')).toEqual(employees)
    expect(filterEmployeesByQuery(employees, '   ')).toEqual(employees)
  })

  it('matches by name ignoring case and accents', () => {
    expect(filterEmployeesByQuery(employees, 'jose angel').map((e) => e.id)).toEqual(['1'])
    expect(filterEmployeesByQuery(employees, 'LOPEZ').map((e) => e.id)).toEqual(['2'])
  })

  it('matches by identification number', () => {
    expect(filterEmployeesByQuery(employees, '1002').map((e) => e.id)).toEqual(['3'])
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterEmployeesByQuery(employees, 'zzz')).toEqual([])
  })
})
