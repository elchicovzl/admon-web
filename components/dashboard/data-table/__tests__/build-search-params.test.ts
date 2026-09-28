import { describe, it, expect } from 'vitest'
import { buildSearchParams } from '../build-search-params'

describe('buildSearchParams', () => {
  it('sets a new key', () => {
    const params = buildSearchParams('', { status: 'ACTIVE' })
    expect(params.get('status')).toBe('ACTIVE')
  })

  it('resets page to 1 by deleting it when a filter changes', () => {
    const params = buildSearchParams('page=3&status=ACTIVE', { status: 'DONE' })
    expect(params.has('page')).toBe(false)
    expect(params.get('status')).toBe('DONE')
  })

  it('keeps the page param when keepPage is true', () => {
    const params = buildSearchParams('page=3', { page: '4' }, { keepPage: true })
    expect(params.get('page')).toBe('4')
  })

  it('deletes a key when the patched value is undefined', () => {
    const params = buildSearchParams('q=miguel', { q: undefined })
    expect(params.has('q')).toBe(false)
  })

  it('deletes a key when the patched value is an empty string', () => {
    const params = buildSearchParams('q=miguel', { q: '' })
    expect(params.has('q')).toBe(false)
  })

  it('deletes a key when the patched value is the "__all__" sentinel', () => {
    const params = buildSearchParams('processType=SALUD', { processType: '__all__' })
    expect(params.has('processType')).toBe(false)
  })

  it('leaves untouched keys as-is', () => {
    const params = buildSearchParams('q=miguel&status=ACTIVE', { status: 'DONE' })
    expect(params.get('q')).toBe('miguel')
  })

  it('accepts a URLSearchParams instance as the current value', () => {
    const current = new URLSearchParams('page=2')
    const params = buildSearchParams(current, { sortBy: 'startDate' })
    expect(params.get('sortBy')).toBe('startDate')
    expect(params.has('page')).toBe(false)
  })

  it('applies multiple patch entries in one call', () => {
    const params = buildSearchParams('', { sortBy: 'company', sortDir: 'asc' })
    expect(params.get('sortBy')).toBe('company')
    expect(params.get('sortDir')).toBe('asc')
  })
})
