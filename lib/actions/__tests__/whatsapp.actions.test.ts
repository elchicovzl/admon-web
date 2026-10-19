import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '@prisma/client'

const { prismaMock, authMock, hasWhatsAppAccessMock, presignGetMock } = vi.hoisted(() => ({
  prismaMock: { whatsAppMedia: { findUnique: vi.fn() } },
  authMock: vi.fn(),
  hasWhatsAppAccessMock: vi.fn(),
  presignGetMock: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/auth/auth', () => ({ auth: authMock }))
vi.mock('@/lib/auth/rbac', () => ({ hasWhatsAppAccess: hasWhatsAppAccessMock }))
vi.mock('@/lib/storage/r2', () => ({ presignGet: presignGetMock }))

import { getMediaUrl } from '../whatsapp.actions'

const MESSAGE_ID = 'cjld2cjxh0000qzrmn831i7rn'

function stored(overrides: Record<string, unknown> = {}) {
  return {
    status: 'STORED',
    s3Key: 'whatsapp/conv-1/msg-1/META123.jpg',
    mimeType: 'image/jpeg',
    fileName: null,
    r2DeletedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  authMock.mockResolvedValue({ user: { id: 'u1', role: UserRole.MANAGER } })
  hasWhatsAppAccessMock.mockResolvedValue(true)
  prismaMock.whatsAppMedia.findUnique.mockResolvedValue(stored())
  presignGetMock.mockResolvedValue('https://signed.example/object')
})

describe('getMediaUrl: authorization (S-MH-8, MH-2)', () => {
  it('rejects unauthenticated callers without touching the DB or R2', async () => {
    authMock.mockResolvedValue(null)

    const r = await getMediaUrl({ messageId: MESSAGE_ID })

    expect(r).toEqual({ success: false, error: 'No autenticado' })
    expect(prismaMock.whatsAppMedia.findUnique).not.toHaveBeenCalled()
    expect(presignGetMock).not.toHaveBeenCalled()
  })

  it('denies a MANAGER without WhatsApp access', async () => {
    hasWhatsAppAccessMock.mockResolvedValue(false)

    const r = await getMediaUrl({ messageId: MESSAGE_ID })

    expect(r).toEqual({ success: false, error: 'No tienes acceso al módulo de WhatsApp' })
    expect(prismaMock.whatsAppMedia.findUnique).not.toHaveBeenCalled()
    expect(presignGetMock).not.toHaveBeenCalled()
  })

  it('allows a MANAGER with WhatsApp access', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', role: UserRole.MANAGER } })
    hasWhatsAppAccessMock.mockResolvedValue(true)

    const r = await getMediaUrl({ messageId: MESSAGE_ID })

    expect(r.success).toBe(true)
  })

  it('allows SUPER_ADMIN (hasWhatsAppAccess grants it by role)', async () => {
    authMock.mockResolvedValue({ user: { id: 'u9', role: UserRole.SUPER_ADMIN } })
    hasWhatsAppAccessMock.mockResolvedValue(true)

    const r = await getMediaUrl({ messageId: MESSAGE_ID })

    expect(r.success).toBe(true)
  })

  it('does not trust a session claim: the database check decides', async () => {
    authMock.mockResolvedValue({
      user: { id: 'u1', role: UserRole.MANAGER, canAccessWhatsApp: true },
    })
    hasWhatsAppAccessMock.mockResolvedValue(false)

    const r = await getMediaUrl({ messageId: MESSAGE_ID })

    expect(r.success).toBe(false)
    expect(hasWhatsAppAccessMock).toHaveBeenCalled()
  })
})

describe('getMediaUrl: behavior', () => {
  it('returns a 10-minute presigned URL and never the R2 key', async () => {
    const r = await getMediaUrl({ messageId: MESSAGE_ID })

    expect(presignGetMock).toHaveBeenCalledWith('whatsapp/conv-1/msg-1/META123.jpg', {
      expiresInSeconds: 600,
      contentType: 'image/jpeg',
      fileName: undefined,
      disposition: 'inline',
    })
    expect(r).toEqual({
      success: true,
      data: { url: 'https://signed.example/object', mimeType: 'image/jpeg', fileName: null, expiresInSeconds: 600 },
    })
    expect(JSON.stringify(r)).not.toContain('whatsapp/conv-1')
  })

  it('serves non-renderable types as downloads', async () => {
    prismaMock.whatsAppMedia.findUnique.mockResolvedValue(
      stored({ mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileName: 'carta.docx' })
    )

    await getMediaUrl({ messageId: MESSAGE_ID })

    expect(presignGetMock.mock.calls[0][1]).toMatchObject({ disposition: 'attachment', fileName: 'carta.docx' })
  })

  it.each([
    ['PENDING', 'El archivo aún se está descargando'],
    ['FAILED', 'El archivo no está disponible'],
    ['TOO_LARGE', 'El archivo no está disponible'],
    ['UNSUPPORTED', 'El archivo no está disponible'],
  ])('refuses a %s file', async (status, error) => {
    prismaMock.whatsAppMedia.findUnique.mockResolvedValue(stored({ status, s3Key: null }))

    await expect(getMediaUrl({ messageId: MESSAGE_ID })).resolves.toEqual({ success: false, error })
    expect(presignGetMock).not.toHaveBeenCalled()
  })

  it('refuses a file already purged from R2', async () => {
    prismaMock.whatsAppMedia.findUnique.mockResolvedValue(stored({ r2DeletedAt: new Date() }))

    const r = await getMediaUrl({ messageId: MESSAGE_ID })

    expect(r.success).toBe(false)
    expect(presignGetMock).not.toHaveBeenCalled()
  })

  it('reports an unknown message', async () => {
    prismaMock.whatsAppMedia.findUnique.mockResolvedValue(null)

    await expect(getMediaUrl({ messageId: MESSAGE_ID })).resolves.toEqual({ success: false, error: 'Archivo no encontrado' })
  })

  it('rejects malformed ids with Zod before querying', async () => {
    const r = await getMediaUrl({ messageId: "x'; DROP TABLE" })

    expect(r).toEqual({ success: false, error: 'Mensaje inválido' })
    expect(prismaMock.whatsAppMedia.findUnique).not.toHaveBeenCalled()
  })

  it('fails closed without leaking storage errors', async () => {
    presignGetMock.mockRejectedValue(new Error('R2 credentials not configured: acct-123'))

    const r = await getMediaUrl({ messageId: MESSAGE_ID })

    expect(r).toEqual({ success: false, error: 'No se pudo obtener el archivo' })
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('acct-123')
  })
})
