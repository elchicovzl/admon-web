import { describe, expect, it } from 'vitest'
import { AVATAR_PALETTE, avatarColorClass, avatarInitials } from '../avatar'

describe('avatarInitials', () => {
  it('takes the first letter of up to two words, uppercased', () => {
    expect(avatarInitials('ana pérez')).toBe('AP')
    expect(avatarInitials('Ana María de la Cruz')).toBe('AM')
    expect(avatarInitials('Ana')).toBe('A')
  })

  it('handles accents, extra spaces and leading symbols', () => {
    expect(avatarInitials('  álvaro   ñandú ')).toBe('ÁÑ')
    expect(avatarInitials('~Luis (Cliente)')).toBe('LC')
  })

  it('skips words without letters', () => {
    expect(avatarInitials('123 Ana')).toBe('A')
  })

  it('is null for digits-only, phone numbers and empty names', () => {
    expect(avatarInitials('+573001112233')).toBeNull()
    expect(avatarInitials('300 111 2233')).toBeNull()
    expect(avatarInitials('')).toBeNull()
    expect(avatarInitials(null)).toBeNull()
    expect(avatarInitials(undefined)).toBeNull()
  })
})

describe('avatarColorClass', () => {
  it('is deterministic for the same seed', () => {
    expect(avatarColorClass('clx123')).toBe(avatarColorClass('clx123'))
  })

  it('always returns a palette entry', () => {
    for (let i = 0; i < 200; i++) expect(AVATAR_PALETTE).toContain(avatarColorClass(`seed-${i}`))
  })

  it('spreads different seeds over the palette', () => {
    const used = new Set(Array.from({ length: 200 }, (_, i) => avatarColorClass(`seed-${i}`)))
    expect(used.size).toBe(AVATAR_PALETTE.length)
  })

  it('has light and dark variants for every entry', () => {
    for (const entry of AVATAR_PALETTE) {
      expect(entry).toMatch(/\bbg-/)
      expect(entry).toMatch(/\btext-/)
      expect(entry).toMatch(/dark:bg-/)
      expect(entry).toMatch(/dark:text-/)
    }
  })
})
