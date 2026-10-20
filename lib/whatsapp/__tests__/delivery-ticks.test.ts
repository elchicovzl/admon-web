import { describe, expect, it } from 'vitest'
import { deliveryTick, tickColorClass } from '../delivery-ticks'

describe('deliveryTick', () => {
  it.each([
    ['QUEUED', 'clock', 'muted', 'Enviando'],
    ['SENT', 'check', 'muted', 'Enviado'],
    ['DELIVERED', 'check-check', 'muted', 'Entregado'],
    ['READ', 'check-check', 'read', 'Leído'],
    ['FAILED', 'alert', 'error', 'Falló'],
  ] as const)('%s -> %s (%s)', (status, icon, tone, label) => {
    expect(deliveryTick(status)).toEqual({ icon, tone, label })
  })

  it('shows nothing for RECEIVED', () => {
    expect(deliveryTick('RECEIVED')).toBeNull()
  })
})

describe('tickColorClass', () => {
  it('keeps read blue and failure red on the primary bubble, in both themes', () => {
    expect(tickColorClass('read', true)).toMatch(/sky-400.*dark:text-sky-600/)
    expect(tickColorClass('error', true)).toMatch(/red-400.*dark:text-red-600/)
    expect(tickColorClass('muted', true)).toContain('primary-foreground')
  })

  it('uses theme-aware colors on tinted bubbles', () => {
    expect(tickColorClass('read', false)).toMatch(/sky-600.*dark:text-sky-400/)
    expect(tickColorClass('muted', false)).toBe('text-muted-foreground')
    expect(tickColorClass('error', false)).toBe('text-destructive')
  })

  it('read is blue and never the muted gray', () => {
    expect(tickColorClass('read', true)).not.toBe(tickColorClass('muted', true))
    expect(tickColorClass('read', false)).not.toBe(tickColorClass('muted', false))
  })
})
