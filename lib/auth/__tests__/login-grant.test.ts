/**
 * login-grant.test.ts
 *
 * Cierra el circuito del login: authorize() EXIGE un permiso de un solo uso
 * (ver authorize.test.ts), y este archivo verifica que verifyOtp() lo EMITA.
 *
 * Si alguien saca la emisión, authorize seguiría rechazando todo y nadie
 * podría entrar. Si alguien saca la exigencia, vuelve el bypass. Los dos
 * archivos se cubren mutuamente.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const EMAIL = 'admin@admon.com'
const CODIGO = '482913'

const { prismaMock, signInMock, verifyOtpHashMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    verificationToken: {
      findFirst: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  signInMock: vi.fn(),
  verifyOtpHashMock: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/auth/auth', () => ({
  signIn: signInMock,
  signOut: vi.fn(),
  auth: vi.fn(),
}))
vi.mock('@/lib/utils/otp', () => ({
  generateOtpCode: vi.fn(() => CODIGO),
  hashOtp: vi.fn(async (c: string) => `hash:${c}`),
  verifyOtp: verifyOtpHashMock,
  checkRateLimit: vi.fn(),
  cleanupExpiredTokens: vi.fn(),
}))
vi.mock('@/lib/email', () => ({
  sendOtpEmail: vi.fn(),
  sendLoginSuccessEmail: vi.fn(),
}))

import { verifyOtp } from '@/lib/actions/auth.actions'
import { LOGIN_GRANT_PREFIX } from '../login-grant'

beforeEach(() => {
  vi.clearAllMocks()

  prismaMock.user.findUnique.mockResolvedValue({
    id: 'cuseradmin0001',
    name: 'Super Admin',
    email: EMAIL,
    isActive: true,
  })
  prismaMock.verificationToken.findFirst.mockResolvedValue({
    identifier: EMAIL,
    token: `hash:${CODIGO}`,
    expires: new Date(Date.now() + 300_000),
  })
  prismaMock.verificationToken.delete.mockResolvedValue({})
  prismaMock.verificationToken.create.mockResolvedValue({})
  verifyOtpHashMock.mockResolvedValue(true)
})

describe('verifyOtp — emisión del permiso de login', () => {
  it('emite un permiso y se lo pasa a signIn', async () => {
    const resultado = await verifyOtp({ email: EMAIL, code: CODIGO })

    expect(resultado.success).toBe(true)

    // Se creó un permiso con el prefijo que espera authorize().
    expect(prismaMock.verificationToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        identifier: `${LOGIN_GRANT_PREFIX}${EMAIL}`,
      }),
    })

    // Y el MISMO secreto viajó a signIn. Sin esto, authorize rechaza.
    const permisoCreado = prismaMock.verificationToken.create.mock.calls[0][0].data.token
    expect(signInMock).toHaveBeenCalledWith('credentials', {
      email: EMAIL,
      loginToken: permisoCreado,
      redirect: false,
    })
  })

  it('el permiso es un secreto largo, no algo adivinable', async () => {
    await verifyOtp({ email: EMAIL, code: CODIGO })

    const token: string =
      prismaMock.verificationToken.create.mock.calls[0][0].data.token

    // randomBytes(32) en hex = 64 caracteres.
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('el permiso vence pronto', async () => {
    const antes = Date.now()
    await verifyOtp({ email: EMAIL, code: CODIGO })

    const expires: Date =
      prismaMock.verificationToken.create.mock.calls[0][0].data.expires
    const vidaMs = expires.getTime() - antes

    expect(vidaMs).toBeGreaterThan(0)
    expect(vidaMs).toBeLessThanOrEqual(60_000)
  })

  it('NO emite permiso si el código es incorrecto', async () => {
    verifyOtpHashMock.mockResolvedValue(false)

    const resultado = await verifyOtp({ email: EMAIL, code: '000000' })

    expect(resultado.success).toBe(false)
    expect(prismaMock.verificationToken.create).not.toHaveBeenCalled()
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('NO emite permiso si no hay código vigente', async () => {
    prismaMock.verificationToken.findFirst.mockResolvedValue(null)

    const resultado = await verifyOtp({ email: EMAIL, code: CODIGO })

    expect(resultado.success).toBe(false)
    expect(prismaMock.verificationToken.create).not.toHaveBeenCalled()
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('NO emite permiso para un usuario desactivado', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'cuseradmin0001',
      email: EMAIL,
      isActive: false,
    })

    const resultado = await verifyOtp({ email: EMAIL, code: CODIGO })

    expect(resultado.success).toBe(false)
    expect(prismaMock.verificationToken.create).not.toHaveBeenCalled()
    expect(signInMock).not.toHaveBeenCalled()
  })
})
