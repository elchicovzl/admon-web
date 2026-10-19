import { describe, expect, it } from 'vitest'
import { mutedStorageKey, readMuted, writeMuted } from '../preferences'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

describe('mute preference', () => {
  it('defaults to sound on', () => {
    expect(readMuted(memoryStorage(), 'u1')).toBe(false)
  })

  it('persists per user', () => {
    const storage = memoryStorage()

    writeMuted(storage, 'u1', true)

    expect(readMuted(storage, 'u1')).toBe(true)
    expect(readMuted(storage, 'u2')).toBe(false)
    expect(storage.data.get(mutedStorageKey('u1'))).toBe('1')
  })

  it('can be switched back on', () => {
    const storage = memoryStorage()
    writeMuted(storage, 'u1', true)
    writeMuted(storage, 'u1', false)

    expect(readMuted(storage, 'u1')).toBe(false)
  })

  it('survives a missing or throwing storage', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }

    expect(readMuted(null, 'u1')).toBe(false)
    expect(readMuted(broken, 'u1')).toBe(false)
    expect(() => writeMuted(broken, 'u1', true)).not.toThrow()
    expect(() => writeMuted(undefined, 'u1', true)).not.toThrow()
  })
})
