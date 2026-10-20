import { describe, expect, it } from 'vitest'
import { LEAD_STATUS_LABEL, leadDisplayName, leadToClientDefaults } from '../leads'

const lead = {
  phoneE164: '+573001234567',
  displayName: 'Test User',
  fullName: null,
  email: null,
  identificationType: null,
  identificationNumber: null,
}

describe('leadDisplayName', () => {
  it('prefers the collected name, then the WhatsApp profile name, then the phone', () => {
    expect(leadDisplayName({ ...lead, fullName: 'Ana Pérez' })).toBe('Ana Pérez')
    expect(leadDisplayName(lead)).toBe('Test User')
    expect(leadDisplayName({ ...lead, displayName: null })).toBe('+573001234567')
  })
})

describe('leadToClientDefaults (S-LD-4: the client form opens prefilled)', () => {
  it('carries name and phone in the client form phone format', () => {
    expect(leadToClientDefaults(lead)).toEqual({ fullName: 'Test User', phone: '+57 3001234567' })
  })

  it('carries the details a manager collected, which win over the profile name', () => {
    expect(
      leadToClientDefaults({
        ...lead,
        fullName: 'Ana Pérez',
        email: 'ana@example.com',
        identificationType: 'CEDULA',
        identificationNumber: '1000000000',
      })
    ).toEqual({
      fullName: 'Ana Pérez',
      phone: '+57 3001234567',
      email: 'ana@example.com',
      identificationType: 'CEDULA',
      identificationNumber: '1000000000',
    })
  })

  it('keeps a foreign number with its own country code', () => {
    expect(leadToClientDefaults({ ...lead, phoneE164: '+15552045003' }).phone).toBe('+1 5552045003')
  })
})

describe('LEAD_STATUS_LABEL', () => {
  it('labels every status in Spanish', () => {
    expect(LEAD_STATUS_LABEL).toEqual({
      NEW: 'Nuevo',
      CONTACTED: 'Contactado',
      CONVERTED: 'Convertido',
      DISCARDED: 'Descartado',
    })
  })
})
