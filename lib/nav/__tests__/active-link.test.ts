/**
 * Tests for sidebar active-link resolution.
 *
 * Every case here corresponds to something that was actually broken on
 * screen and invisible to the type checker: a detail page highlighting
 * nothing, and two siblings sharing a path where neither matched.
 */

import { describe, expect, it } from 'vitest'
import { containsActiveHref, findActiveHref, scoreLink } from '../active-link'

// -----------------------------------------------------------------------------
// The real Finanzas menu, trimmed to what matters here
// -----------------------------------------------------------------------------

const MENU = [
  { href: '/dashboard/finances' }, // Resumen
  {
    subItems: [
      { href: '/dashboard/finances/invoices' },
      { href: '/dashboard/finances/estimates' },
      {
        href: '/dashboard/finances/payments?type=in',
        matchParam: { key: 'type', value: 'in' },
      },
    ],
  },
  {
    subItems: [
      { href: '/dashboard/finances/bills' },
      {
        href: '/dashboard/finances/payments?type=out',
        matchParam: { key: 'type', value: 'out' },
        matchFallback: true,
      },
    ],
  },
]

const params = (qs = '') => new URLSearchParams(qs)

// -----------------------------------------------------------------------------
// Siblings sharing a path (Cobros vs Pagos)
// -----------------------------------------------------------------------------

describe('links que comparten path y difieren por query', () => {
  it('?type=in marca Cobros', () => {
    expect(findActiveHref(MENU, '/dashboard/finances/payments', params('type=in')))
      .toBe('/dashboard/finances/payments?type=in')
  })

  it('?type=out marca Pagos', () => {
    expect(findActiveHref(MENU, '/dashboard/finances/payments', params('type=out')))
      .toBe('/dashboard/finances/payments?type=out')
  })

  it('SIN query marca el fallback, no deja el menú sin selección', () => {
    // The regression: with neither sibling matching, nothing highlighted and
    // both groups stayed collapsed.
    expect(findActiveHref(MENU, '/dashboard/finances/payments', params()))
      .toBe('/dashboard/finances/payments?type=out')
  })

  it('nunca marca los dos a la vez', () => {
    const active = findActiveHref(MENU, '/dashboard/finances/payments', params('type=in'))
    // Exactly one href can equal `active`, by construction — assert the other
    // sibling explicitly so the intent is on record.
    expect(active).not.toBe('/dashboard/finances/payments?type=out')
  })

  it('un query irrelevante no rompe el fallback', () => {
    expect(findActiveHref(MENU, '/dashboard/finances/payments', params('page=3')))
      .toBe('/dashboard/finances/payments?type=out')
  })

  it('un valor desconocido de type cae al fallback', () => {
    // `parsePaymentFilters` already drops garbage; the menu shouldn't blank out
    // just because someone hand-edited the URL.
    const active = findActiveHref(MENU, '/dashboard/finances/payments', params('type=sideways'))
    expect(active).toBe('/dashboard/finances/payments?type=out')
  })
})

// -----------------------------------------------------------------------------
// Specificity
// -----------------------------------------------------------------------------

describe('gana el link más específico', () => {
  it('una página de detalle marca su listado, no el Resumen', () => {
    // The older regression: exact matching meant detail pages lit up nothing.
    expect(findActiveHref(MENU, '/dashboard/finances/invoices/2070', params()))
      .toBe('/dashboard/finances/invoices')
  })

  it('el detalle de una factura de compra marca Facturas de compra', () => {
    expect(findActiveHref(MENU, '/dashboard/finances/bills/915', params()))
      .toBe('/dashboard/finances/bills')
  })

  it('el Resumen gana solo en su propia ruta exacta', () => {
    expect(findActiveHref(MENU, '/dashboard/finances', params()))
      .toBe('/dashboard/finances')
  })

  it('un listado NO marca el Resumen aunque comparta prefijo', () => {
    expect(findActiveHref(MENU, '/dashboard/finances/estimates', params()))
      .toBe('/dashboard/finances/estimates')
  })

  it('devuelve null fuera del árbol', () => {
    expect(findActiveHref(MENU, '/dashboard/clients', params())).toBeNull()
  })

  it('no confunde un prefijo parcial de segmento', () => {
    // /finances/billing must NOT match /finances/bills — the boundary check
    // is on the "/" separator, not on raw string prefix.
    expect(findActiveHref(MENU, '/dashboard/finances/billing', params()))
      .toBe('/dashboard/finances')
  })
})

// -----------------------------------------------------------------------------
// scoreLink
// -----------------------------------------------------------------------------

describe('scoreLink', () => {
  it('-1 cuando el path no coincide', () => {
    expect(scoreLink({ href: '/a/b' }, '/x/y', params())).toBe(-1)
  })

  it('un path más profundo puntúa más alto', () => {
    const shallow = scoreLink({ href: '/dashboard/finances' }, '/dashboard/finances/bills', params())
    const deep = scoreLink({ href: '/dashboard/finances/bills' }, '/dashboard/finances/bills', params())
    expect(deep).toBeGreaterThan(shallow)
  })

  it('el query exacto le gana a cualquier hermano por longitud de path', () => {
    const withParam = scoreLink(
      { href: '/p?type=out', matchParam: { key: 'type', value: 'out' } },
      '/p',
      params('type=out'),
    )
    const longerPathNoParam = scoreLink({ href: '/p' }, '/p', params('type=out'))
    expect(withParam).toBeGreaterThan(longerPathNoParam)
  })

  it('-1 si el param está presente pero apunta al hermano', () => {
    expect(
      scoreLink(
        { href: '/p?type=in', matchParam: { key: 'type', value: 'in' } },
        '/p',
        params('type=out'),
      ),
    ).toBe(-1)
  })

  it('el fallback sigue puntuando con un valor desconocido', () => {
    // Bailing out here let an ancestor win by prefix — /finances/payments
    // ended up highlighting "Resumen".
    expect(
      scoreLink(
        { href: '/p?type=out', matchParam: { key: 'type', value: 'out' }, matchFallback: true },
        '/p',
        params('type=garbage'),
      ),
    ).toBeGreaterThan(-1)
  })

  it('-1 si el param está ausente y no es el fallback', () => {
    expect(
      scoreLink({ href: '/p?type=in', matchParam: { key: 'type', value: 'in' } }, '/p', params()),
    ).toBe(-1)
  })

  it('puntúa si el param está ausente y ES el fallback', () => {
    expect(
      scoreLink(
        { href: '/p?type=out', matchParam: { key: 'type', value: 'out' }, matchFallback: true },
        '/p',
        params(),
      ),
    ).toBeGreaterThan(-1)
  })
})

// -----------------------------------------------------------------------------
// containsActiveHref
// -----------------------------------------------------------------------------

describe('containsActiveHref', () => {
  it('encuentra el activo en un grupo anidado', () => {
    // This is what keeps "Finanzas" and "Egresos" expanded on /bills.
    expect(containsActiveHref(MENU, '/dashboard/finances/bills')).toBe(true)
  })

  it('false cuando no hay activo', () => {
    expect(containsActiveHref(MENU, null)).toBe(false)
  })

  it('false cuando el activo está en otra rama', () => {
    const egresos = MENU[2]!.subItems!
    expect(containsActiveHref(egresos, '/dashboard/finances/invoices')).toBe(false)
  })

  it('true para el hermano correcto entre los que comparten path', () => {
    const ingresos = MENU[1]!.subItems!
    const egresos = MENU[2]!.subItems!
    const cobros = '/dashboard/finances/payments?type=in'

    expect(containsActiveHref(ingresos, cobros)).toBe(true)
    expect(containsActiveHref(egresos, cobros)).toBe(false)
  })
})
