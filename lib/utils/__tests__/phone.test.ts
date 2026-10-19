import { describe, expect, it } from 'vitest'
import { formatPhone, normalizeWaId, parsePhone, waIdMatchCandidates, waIdToE164 } from '../phone'

describe('parsePhone', () => {
  it('splits a Colombian number', () => {
    expect(parsePhone('+57 300 123 4567')).toEqual({ dialCode: '57', national: '300 123 4567' })
  })
  it('splits a US/Canada number', () => {
    expect(parsePhone('+1 305 555 0100')).toEqual({ dialCode: '1', national: '305 555 0100' })
  })
  it('splits a 3-digit dial code', () => {
    expect(parsePhone('+593 99 123 4567')).toEqual({ dialCode: '593', national: '99 123 4567' })
  })
  it('handles empty values', () => {
    expect(parsePhone('')).toEqual({ dialCode: '57', national: '' })
    expect(parsePhone(null)).toEqual({ dialCode: '57', national: '' })
  })
  it('falls back to Colombia for digits-only legacy values', () => {
    expect(parsePhone('3001234567')).toEqual({ dialCode: '57', national: '3001234567' })
    expect(parsePhone('573001234567')).toEqual({ dialCode: '57', national: '3001234567' })
  })
  it('falls back to Colombia for unknown codes', () => {
    expect(parsePhone('+999 123 456')).toEqual({ dialCode: '57', national: '+999 123 456' })
  })
})

describe('formatPhone', () => {
  it('joins code and number', () => {
    expect(formatPhone('57', '300 123 4567')).toBe('+57 300 123 4567')
  })
  it('returns empty for an empty number', () => {
    expect(formatPhone('57', '')).toBe('')
    expect(formatPhone('1', '  ')).toBe('')
  })
  it('round-trips', () => {
    const v = '+593 99 123 4567'
    const p = parsePhone(v)
    expect(formatPhone(p.dialCode, p.national)).toBe(v)
  })
})

describe('waId helpers', () => {
  it('normalizes to digits and rejects values that cannot be a phone number', () => {
    expect(normalizeWaId('+57 300 123 4567')).toBe('573001234567')
    expect(normalizeWaId('573001234567')).toBe('573001234567')
    expect(normalizeWaId('123')).toBeNull()
    expect(normalizeWaId('1234567890123456')).toBeNull()
    expect(normalizeWaId('')).toBeNull()
    expect(normalizeWaId(null)).toBeNull()
  })

  it('renders E.164', () => {
    expect(waIdToE164('573001234567')).toBe('+573001234567')
  })

  it('offers full and national candidates for Colombian numbers', () => {
    expect(waIdMatchCandidates('573001234567')).toEqual(['573001234567', '3001234567'])
  })

  it('offers only the full number for other countries (national-only values are read as Colombian)', () => {
    expect(waIdMatchCandidates('13055550100')).toEqual(['13055550100'])
    expect(waIdMatchCandidates('593991234567')).toEqual(['593991234567'])
  })

  it('returns no candidates for invalid ids', () => {
    expect(waIdMatchCandidates('12')).toEqual([])
  })

  it('does not touch the stored phone format: candidates match what Client.phone reduces to', () => {
    const stored = ['+57 300 123 4567', '300 123 4567', '3001234567', '573001234567']
    const candidates = waIdMatchCandidates('573001234567')
    for (const phone of stored) {
      expect(candidates).toContain(phone.replace(/\D/g, ''))
    }
  })
})
