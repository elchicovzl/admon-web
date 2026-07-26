/**
 * Tests for the cache key derivation and TTL/tag policy.
 *
 * `unstable_cache` itself is Next.js infrastructure and not worth mocking —
 * what IS worth testing is `stableKey`, because a subtle bug there either
 * splits one logical entry across many (cache never warms) or collapses two
 * different queries into one (users see the wrong data).
 */

import { describe, expect, it } from 'vitest'
import { ALEGRA_TAGS, ALEGRA_TTL, stableKey } from '../cache'

describe('stableKey', () => {
  it('es independiente del orden de las claves', () => {
    // Same filters built by different call sites must share a cache entry.
    const a = stableKey({ status: 'open', page: 2, limit: 30 })
    const b = stableKey({ limit: 30, status: 'open', page: 2 })

    expect(a).toBe(b)
  })

  it('distingue valores distintos', () => {
    expect(stableKey({ status: 'open' })).not.toBe(stableKey({ status: 'closed' }))
  })

  it('distingue claves distintas con el mismo valor', () => {
    expect(stableKey({ date_after: '2026-01-01' })).not.toBe(
      stableKey({ date_before: '2026-01-01' }),
    )
  })

  it('descarta undefined / null / string vacío', () => {
    // The client skips these when building the URL, so they hit the same
    // upstream endpoint and MUST share a cache entry.
    const withEmpties = stableKey({
      status: 'open',
      client_name: undefined,
      date_after: null,
      date_before: '',
    })

    expect(withEmpties).toBe(stableKey({ status: 'open' }))
  })

  it('devuelve un sentinel para params vacíos en vez de string vacío', () => {
    // An empty fragment would collide with the surrounding keyParts joining.
    expect(stableKey({})).toBe('__empty__')
    expect(stableKey({ a: undefined })).toBe('__empty__')
  })

  it('no confunde el número 0 con ausencia', () => {
    // `start: 0` is page 1 — a real, meaningful value. Filtering it out
    // would make page 1 and "no pagination" share an entry.
    expect(stableKey({ start: 0 })).toBe('start=0')
    expect(stableKey({ start: 0 })).not.toBe(stableKey({}))
  })

  it('distingue false de ausencia', () => {
    expect(stableKey({ metadata: false })).toBe('metadata=false')
    expect(stableKey({ metadata: false })).not.toBe(stableKey({ metadata: true }))
  })
})

describe('ALEGRA_TTL', () => {
  it('company es el TTL más largo — es config, no datos transaccionales', () => {
    expect(ALEGRA_TTL.company).toBeGreaterThan(ALEGRA_TTL.kpis)
  })

  it('los KPIs toleran más staleness que la vista operativa', () => {
    expect(ALEGRA_TTL.kpis).toBeGreaterThan(ALEGRA_TTL.list)
  })

  it('todos los TTL son positivos (0 desactivaría el caché en silencio)', () => {
    for (const [name, ttl] of Object.entries(ALEGRA_TTL)) {
      expect(ttl, `${name} debe ser > 0`).toBeGreaterThan(0)
    }
  })
})

describe('ALEGRA_TAGS', () => {
  it('los tags son únicos', () => {
    const values = Object.values(ALEGRA_TAGS)
    expect(new Set(values).size).toBe(values.length)
  })

  it('los tags específicos comparten el prefijo del tag global', () => {
    // Not functionally required by revalidateTag, but keeps the namespace
    // greppable and avoids collisions with other modules' tags.
    for (const tag of Object.values(ALEGRA_TAGS)) {
      expect(tag.startsWith(ALEGRA_TAGS.all)).toBe(true)
    }
  })
})
