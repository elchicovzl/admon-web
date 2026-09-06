/**
 * email-otp-dev.test.ts
 *
 * En desarrollo el OTP se imprime en la consola del servidor en vez de
 * enviarse por correo. Sin eso no se puede entrar en local: los usuarios del
 * seed viven en un dominio inventado y ese mail no le llega a nadie.
 *
 * Lo que estos tests protegen es el GUARD, no la comodidad. Acá se escribe un
 * código de acceso en un log: si alguien cambia `=== 'development'` por
 * `!== 'production'`, cualquier entorno con NODE_ENV sin setear —un staging,
 * un runner de CI— empezaría a escupir credenciales a un log que nadie mira.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { sendMock, renderMock } = vi.hoisted(() => ({
  sendMock: vi.fn(async () => ({ data: { id: 'resend-id' }, error: null })),
  renderMock: vi.fn(async () => '<html>correo</html>'),
}))

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))
vi.mock('@react-email/render', () => ({ render: renderMock }))
vi.mock('@/emails/otp-email', () => ({ default: () => null }))
vi.mock('@/emails/login-success-email', () => ({ default: () => null }))
vi.mock('@/emails/affiliation-completed-email', () => ({ default: () => null }))
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {},
  GetObjectCommand: class {},
}))

import { sendOtpEmail } from '../email'

/**
 * `process.env` rechaza un descriptor que no sea enumerable, así que
 * Object.defineProperty no sirve acá. vi.stubEnv lo maneja y además se
 * revierte solo con unstubAllEnvs.
 */
function setNodeEnv(valor: string | undefined) {
  vi.stubEnv('NODE_ENV', valor as string)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('RESEND_API_KEY', 're_test_key')
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('sendOtpEmail en desarrollo', () => {
  beforeEach(() => setNodeEnv('development'))

  it('imprime el código y NO envía el correo', async () => {
    await sendOtpEmail({ to: 'admin@admon.com', code: '482913' })

    expect(sendMock).not.toHaveBeenCalled()

    const impreso = (console.log as unknown as ReturnType<typeof vi.fn>).mock
      .calls.flat()
      .join(' ')
    expect(impreso).toContain('482913')
    expect(impreso).toContain('admin@admon.com')
  })
})

describe('sendOtpEmail fuera de desarrollo', () => {
  it('en production SÍ envía y no imprime el código', async () => {
    setNodeEnv('production')

    await sendOtpEmail({ to: 'admin@admon.com', code: '482913' })

    expect(sendMock).toHaveBeenCalledTimes(1)

    const impreso = (console.log as unknown as ReturnType<typeof vi.fn>).mock
      .calls.flat()
      .join(' ')
    expect(impreso).not.toContain('482913')
  })

  it('con NODE_ENV sin setear NO imprime el código', async () => {
    // Este es el caso que distingue `=== development` de `!== production`.
    // Con la comparación laxa, acá se filtraría el código.
    setNodeEnv(undefined)

    await sendOtpEmail({ to: 'admin@admon.com', code: '482913' })

    const impreso = (console.log as unknown as ReturnType<typeof vi.fn>).mock
      .calls.flat()
      .join(' ')
    expect(impreso).not.toContain('482913')
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('en un staging con NODE_ENV=test tampoco imprime', async () => {
    setNodeEnv('test')

    await sendOtpEmail({ to: 'admin@admon.com', code: '482913' })

    const impreso = (console.log as unknown as ReturnType<typeof vi.fn>).mock
      .calls.flat()
      .join(' ')
    expect(impreso).not.toContain('482913')
  })
})
