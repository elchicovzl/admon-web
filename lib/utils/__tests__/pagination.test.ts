import { describe, it, expect } from 'vitest'
import { parsePaginationParams } from '../pagination'

describe('parsePaginationParams', () => {
  it('defaults to page 1, pageSize 25, sortDir undefined when nothing is given', () => {
    expect(parsePaginationParams({})).toEqual({ page: 1, pageSize: 25, sortDir: undefined })
  })

  it('parses a valid page number', () => {
    expect(parsePaginationParams({ page: '3' }).page).toBe(3)
  })

  it('clamps page to a minimum of 1', () => {
    expect(parsePaginationParams({ page: '0' }).page).toBe(1)
    expect(parsePaginationParams({ page: '-5' }).page).toBe(1)
  })

  it('falls back to page 1 for a non-numeric page', () => {
    expect(parsePaginationParams({ page: 'abc' }).page).toBe(1)
  })

  it('parses a valid pageSize within bounds', () => {
    expect(parsePaginationParams({ pageSize: '50' }).pageSize).toBe(50)
  })

  it('clamps pageSize to a minimum of 5', () => {
    expect(parsePaginationParams({ pageSize: '1' }).pageSize).toBe(5)
  })

  it('falls back to the default pageSize (25) for pageSize "0" (falsy parseInt result)', () => {
    // Matches the pre-existing my-assignments/page.tsx behavior this helper
    // was extracted from: `parseInt('0', 10) || 25` treats 0 as falsy.
    expect(parsePaginationParams({ pageSize: '0' }).pageSize).toBe(25)
  })

  it('clamps pageSize to a maximum of 200', () => {
    expect(parsePaginationParams({ pageSize: '500' }).pageSize).toBe(200)
  })

  it('falls back to the default pageSize (25) for a non-numeric pageSize', () => {
    expect(parsePaginationParams({ pageSize: 'abc' }).pageSize).toBe(25)
  })

  it('accepts sortDir "asc" and "desc"', () => {
    expect(parsePaginationParams({ sortDir: 'asc' }).sortDir).toBe('asc')
    expect(parsePaginationParams({ sortDir: 'desc' }).sortDir).toBe('desc')
  })

  it('discards an invalid sortDir', () => {
    expect(parsePaginationParams({ sortDir: 'sideways' }).sortDir).toBeUndefined()
  })
})
