import { describe, expect, it } from 'vitest'
import { handoffOptions } from '../handoff'

const base = { status: 'AI' as const, clientId: null, markers: [] as ('NO_CLIENT' | 'LEAD' | 'AMBIGUOUS')[] }

describe('handoffOptions (mirrors the state machine, D9)', () => {
  it('offers "Atender" from AI and ESCALATED only', () => {
    expect(handoffOptions({ ...base, status: 'AI' }).take).toBe(true)
    expect(handoffOptions({ ...base, status: 'ESCALATED' }).take).toBe(true)
    expect(handoffOptions({ ...base, status: 'HUMAN' }).take).toBe(false)
    expect(handoffOptions({ ...base, status: 'CLOSED' }).take).toBe(false)
  })

  it('offers the hand-back to the AI from HUMAN only (CH-6)', () => {
    expect(handoffOptions({ ...base, status: 'HUMAN' }).returnToAi).toBe(true)
    for (const status of ['AI', 'ESCALATED', 'CLOSED'] as const) {
      expect(handoffOptions({ ...base, status }).returnToAi).toBe(false)
    }
  })

  it('closes any open conversation, reopens only a closed one, and pauses the AI only while open', () => {
    for (const status of ['AI', 'HUMAN', 'ESCALATED'] as const) {
      const options = handoffOptions({ ...base, status })
      expect(options.close).toBe(true)
      expect(options.reopen).toBe(false)
      expect(options.pauseAi).toBe(true)
    }
    const closed = handoffOptions({ ...base, status: 'CLOSED' })
    expect(closed).toMatchObject({ close: false, reopen: true, pauseAi: false })
  })

  it('links a contact without client, unlinks a linked one, and confirms unknown only when ambiguous (LD-8)', () => {
    expect(handoffOptions({ ...base, markers: ['NO_CLIENT', 'LEAD'] })).toMatchObject({
      link: true,
      unlink: false,
      confirmUnknown: false,
    })
    expect(handoffOptions({ ...base, markers: ['AMBIGUOUS'] })).toMatchObject({
      link: true,
      unlink: false,
      confirmUnknown: true,
    })
    expect(handoffOptions({ ...base, clientId: 'client-1' })).toMatchObject({
      link: false,
      unlink: true,
      confirmUnknown: false,
    })
  })

  it('offers the client detail only when the contact is linked to a client', () => {
    expect(handoffOptions({ ...base, clientId: 'client-1' }).viewClient).toBe(true)
    expect(handoffOptions({ ...base, markers: ['AMBIGUOUS'] }).viewClient).toBe(false)
    expect(handoffOptions({ ...base, status: 'CLOSED', clientId: 'client-1' }).viewClient).toBe(true)
  })
})
