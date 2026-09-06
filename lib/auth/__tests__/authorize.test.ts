/**
 * authorize.test.ts
 *
 * Tests del `authorize()` del provider Credentials.
 *
 * Esto existe por una vulnerabilidad concreta: `authorize()` se conformaba con
 * que el email existiera y el usuario estuviera activo, confiando en que
 * `signIn('credentials')` solo se llama desde verifyOtp() después de validar
 * el código. Pero NextAuth expone `/api/auth/callback/credentials` como
 * endpoint HTTP público, así que con dos peticiones —pedir el csrfToken y
 * postear un email— se conseguía una sesión de SUPER_ADMIN sin ver jamás un
 * código.
 *
 * El primer test de este archivo ES ese ataque. Si vuelve a pasar, revienta acá.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserRole } from '@prisma/client'

const EMAIL = 'admin@admon.com'
const OTRO_EMAIL = 'manager@admon.com'
const PERMISO = 'a'.repeat(64)

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    verificationToken: { delete: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }))

import { authConfig } from '../auth.config'
import { LOGIN_GRANT_PREFIX } from '../login-grant'

/**
 * Se toma de `options.authorize`, NO de `provider.authorize`.
 *
 * NextAuth deja en el nivel de arriba un stub por defecto —`() => null`— y
 * guarda la función del usuario en `options`. Es un detalle interno, y por eso
 * importa el bloque "camino legítimo" de más abajo: si una versión futura de
 * NextAuth mueve esto de lugar, los tests que esperan `null` seguirían pasando
 * contra el stub y darían un verde falso. Los que esperan un usuario, no.
 */
const provider = authConfig.providers[0] as unknown as {
  options: { authorize: (credentials: Record<string, unknown>) => Promise<unknown> }
}
const authorize = (credentials: Record<string, unknown>) =>
  provider.options.authorize(credentials)

const USUARIO_ACTIVO = {
  id: 'cuseradmin0001',
  name: 'Super Admin',
  email: EMAIL,
  image: null,
  role: UserRole.SUPER_ADMIN,
  isActive: true,
  canAccessControl: false,
}

/** Fila de permiso tal como la devuelve el delete. */
function permisoValido(email = EMAIL, vencidoHace = 0) {
  return {
    identifier: `${LOGIN_GRANT_PREFIX}${email}`,
    token: PERMISO,
    expires: new Date(Date.now() + (vencidoHace === 0 ? 60_000 : -vencidoHace)),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.user.findUnique.mockResolvedValue(USUARIO_ACTIVO)
})

describe('authorize — el ataque que esto previene', () => {
  it('RECHAZA un login con solo el email (bypass del OTP)', async () => {
    // Reproducción exacta del exploit: POST a
    // /api/auth/callback/credentials con únicamente `email`.
    await expect(authorize({ email: EMAIL })).resolves.toBeNull()

    // Ni siquiera llega a mirar el usuario: sin permiso, no hay nada que ver.
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('RECHAZA un permiso inventado', async () => {
    prismaMock.verificationToken.delete.mockRejectedValue(new Error('not found'))

    await expect(
      authorize({ email: EMAIL, loginToken: 'inventado' })
    ).resolves.toBeNull()
  })

  it('RECHAZA un permiso vacío', async () => {
    await expect(authorize({ email: EMAIL, loginToken: '' })).resolves.toBeNull()
    expect(prismaMock.verificationToken.delete).not.toHaveBeenCalled()
  })

  it('RECHAZA cuando falta el email', async () => {
    await expect(authorize({ loginToken: PERMISO })).resolves.toBeNull()
    expect(prismaMock.verificationToken.delete).not.toHaveBeenCalled()
  })
})

describe('authorize — camino legítimo', () => {
  it('acepta un permiso válido y devuelve el usuario', async () => {
    prismaMock.verificationToken.delete.mockResolvedValue(permisoValido())

    const resultado = await authorize({ email: EMAIL, loginToken: PERMISO })

    expect(resultado).toMatchObject({
      id: USUARIO_ACTIVO.id,
      email: EMAIL,
      role: UserRole.SUPER_ADMIN,
      canAccessControl: false,
    })
  })

  it('CONSUME el permiso: lo borra antes de validarlo', async () => {
    // Consumir primero y preguntar después es lo que lo hace de un solo uso.
    // Validar y después borrar dejaría una ventana para reusarlo.
    prismaMock.verificationToken.delete.mockResolvedValue(permisoValido())

    await authorize({ email: EMAIL, loginToken: PERMISO })

    expect(prismaMock.verificationToken.delete).toHaveBeenCalledWith({
      where: { token: PERMISO },
    })
  })
})

describe('authorize — permisos que no corresponden', () => {
  it('RECHAZA un permiso emitido para otra cuenta', async () => {
    prismaMock.verificationToken.delete.mockResolvedValue(permisoValido(OTRO_EMAIL))

    await expect(
      authorize({ email: EMAIL, loginToken: PERMISO })
    ).resolves.toBeNull()
  })

  it('RECHAZA un permiso vencido', async () => {
    prismaMock.verificationToken.delete.mockResolvedValue(permisoValido(EMAIL, 30_000))

    await expect(
      authorize({ email: EMAIL, loginToken: PERMISO })
    ).resolves.toBeNull()
  })

  it('RECHAZA a un usuario desactivado aunque el permiso sea válido', async () => {
    prismaMock.verificationToken.delete.mockResolvedValue(permisoValido())
    prismaMock.user.findUnique.mockResolvedValue({
      ...USUARIO_ACTIVO,
      isActive: false,
    })

    await expect(
      authorize({ email: EMAIL, loginToken: PERMISO })
    ).resolves.toBeNull()
  })

  it('RECHAZA si el usuario ya no existe', async () => {
    prismaMock.verificationToken.delete.mockResolvedValue(permisoValido())
    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(
      authorize({ email: EMAIL, loginToken: PERMISO })
    ).resolves.toBeNull()
  })
})
