import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ requireAuth: vi.fn(), sendMediaReply: vi.fn() }))

vi.mock('@/lib/whatsapp/access', () => ({
  requireWhatsAppAuth: m.requireAuth,
  WHATSAPP_ERROR_NOT_AUTHENTICATED: 'No autenticado',
}))
vi.mock('@/lib/whatsapp/outbound', () => ({ sendMediaReply: m.sendMediaReply }))

import { POST, dynamic, runtime } from '../route'

const CONV = 'cjld2cjxh0000qzrmn831i7rn'

function request(fields: Record<string, string | File | undefined>, headers: Record<string, string> = {}) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) form.append(key, value)
  return new NextRequest('http://localhost/api/whatsapp/messages/media', { method: 'POST', body: form, headers })
}
const png = () => new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47])], 'foto.png', { type: 'image/png' })

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  m.requireAuth.mockResolvedValue({ authorized: true, userId: 'u1' })
  m.sendMediaReply.mockResolvedValue({ success: true, data: { messageId: 'msg-1' } })
})

describe('POST /api/whatsapp/messages/media', () => {
  it('runs on the node runtime and is never cached', () => {
    expect(runtime).toBe('nodejs')
    expect(dynamic).toBe('force-dynamic')
  })

  it('answers 401 when there is no session and 403 without module access, before reading the body', async () => {
    m.requireAuth.mockResolvedValue({ authorized: false, error: 'No autenticado' })
    const unauthenticated = await POST(request({ conversationId: CONV, file: png() }))
    expect(unauthenticated.status).toBe(401)

    m.requireAuth.mockResolvedValue({ authorized: false, error: 'No tienes acceso al módulo de WhatsApp' })
    const denied = await POST(request({ conversationId: CONV, file: png() }))
    expect(denied.status).toBe(403)
    expect(await denied.json()).toEqual({ success: false, error: 'No tienes acceso al módulo de WhatsApp' })

    expect(m.sendMediaReply).not.toHaveBeenCalled()
  })

  it('hands the file, the caption and the AUTHENTICATED user to the shared service', async () => {
    const response = await POST(request({ conversationId: CONV, caption: ' Su cédula ', file: png() }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, data: { messageId: 'msg-1' } })
    const call = m.sendMediaReply.mock.calls[0][0]
    expect(call).toMatchObject({ conversationId: CONV, userId: 'u1', caption: 'Su cédula' })
    expect(call.file).toMatchObject({ name: 'foto.png', type: 'image/png', size: 4 })
    expect(await call.file.bytes()).toEqual(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))
  })

  it('ignores a user id supplied in the form', async () => {
    await POST(request({ conversationId: CONV, userId: 'attacker', file: png() }))
    expect(m.sendMediaReply.mock.calls[0][0].userId).toBe('u1')
  })

  it('rejects a missing file and bad fields with 400', async () => {
    expect((await POST(request({ conversationId: CONV }))).status).toBe(400)
    expect((await POST(request({ conversationId: 'x', file: png() }))).status).toBe(400)
    expect((await POST(request({ file: png() }))).status).toBe(400)
    expect((await POST(request({ conversationId: CONV, caption: 'a'.repeat(1025), file: png() }))).status).toBe(400)
    expect(m.sendMediaReply).not.toHaveBeenCalled()
  })

  it('treats a text value in the file field as no file', async () => {
    expect((await POST(request({ conversationId: CONV, file: 'not a file' }))).status).toBe(400)
  })

  it('refuses a body whose declared size is far above the limit without parsing it', async () => {
    const response = await POST(request({ conversationId: CONV, file: png() }, { 'content-length': String(50 * 1024 * 1024) }))

    expect(response.status).toBe(413)
    expect(m.sendMediaReply).not.toHaveBeenCalled()
  })

  it('maps a service failure to 400 with its Spanish message', async () => {
    m.sendMediaReply.mockResolvedValue({ success: false, error: 'La ventana de 24 horas está cerrada. Solo puede enviar plantillas aprobadas.' })

    const response = await POST(request({ conversationId: CONV, file: png() }))

    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain('ventana de 24 horas')
  })

  it('answers 500 with a generic message when the service throws', async () => {
    m.sendMediaReply.mockRejectedValue(new Error('postgres://secret'))

    const response = await POST(request({ conversationId: CONV, file: png() }))

    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain('postgres')
  })
})
