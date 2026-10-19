import { describe, expect, it } from 'vitest'
import { formatPhone, parsePhone } from '../phone'

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
