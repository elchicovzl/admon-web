import { describe, it, expect } from 'vitest'
import { configuracionEmpresaSchema } from '../configuracion-empresa.schema'

const valido = {
  razonSocial: 'Empresa S.A.S.',
  nit: '900123456-7',
  direccion: 'Calle 1 # 2-3',
  ciudad: 'Bogotá',
  telefono: '3000000000',
  email: 'contacto@example.com',
}

describe('configuracionEmpresaSchema', () => {
  it('accepts valid data and trims strings', () => {
    const r = configuracionEmpresaSchema.safeParse({ ...valido, razonSocial: '  Empresa S.A.S.  ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.razonSocial).toBe('Empresa S.A.S.')
  })

  it('accepts a NIT without check digit', () => {
    expect(configuracionEmpresaSchema.safeParse({ ...valido, nit: '900123456' }).success).toBe(true)
  })

  it.each(['razonSocial', 'nit', 'direccion', 'ciudad', 'telefono', 'email'])(
    'rejects an empty or blank %s',
    (campo) => {
      expect(configuracionEmpresaSchema.safeParse({ ...valido, [campo]: '   ' }).success).toBe(false)
    }
  )

  it.each(['900.123.456-7', '900123456-77', 'ABC123456', '12345', '900 123 456'])(
    'rejects the bad NIT %s',
    (nit) => {
      const r = configuracionEmpresaSchema.safeParse({ ...valido, nit })
      expect(r.success).toBe(false)
      if (!r.success) expect(r.error.issues[0].message).toContain('NIT inválido')
    }
  )

  it('rejects a malformed email', () => {
    const r = configuracionEmpresaSchema.safeParse({ ...valido, email: 'no-es-correo' })
    expect(r.success).toBe(false)
  })
})
