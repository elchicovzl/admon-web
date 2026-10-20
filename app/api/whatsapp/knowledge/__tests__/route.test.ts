import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ requireAuth: vi.fn(), create: vi.fn(), getAiConfig: vi.fn() }))

vi.mock('@/lib/whatsapp/access', () => ({
  requireWhatsAppAuth: m.requireAuth,
  WHATSAPP_ERROR_NOT_AUTHENTICATED: 'No autenticado',
}))
vi.mock('@/lib/knowledge/documents', () => ({
  createKnowledgeDocument: m.create,
  DOCUMENT_ERRORS: { STORAGE: 'No se pudo guardar el archivo. Intente de nuevo.' },
}))
vi.mock('@/lib/config/runtime-config', () => ({ getAiConfig: m.getAiConfig }))

import { POST, dynamic, runtime } from '../route'

function request(fields: Record<string, string | File | undefined>, headers: Record<string, string> = {}) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) form.append(key, value)
  return new NextRequest('http://localhost/api/whatsapp/knowledge', { method: 'POST', body: form, headers })
}
const pdf = () => new File([new TextEncoder().encode('%PDF-1.4 x')], 'guia.pdf', { type: 'application/pdf' })

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  m.requireAuth.mockResolvedValue({ authorized: true, userId: 'u1' })
  m.create.mockResolvedValue({ ok: true, documentId: 'doc-1', queued: true })
  m.getAiConfig.mockReturnValue({ kbUploadMaxBytes: 1024 * 1024 })
})

describe('POST /api/whatsapp/knowledge', () => {
  it('runs on the node runtime and is never cached', () => {
    expect(runtime).toBe('nodejs')
    expect(dynamic).toBe('force-dynamic')
  })

  it('answers 401 without a session and 403 without WhatsApp access, before reading the body (S-KB-1)', async () => {
    m.requireAuth.mockResolvedValue({ authorized: false, error: 'No autenticado' })
    expect((await POST(request({ file: pdf() }))).status).toBe(401)

    m.requireAuth.mockResolvedValue({ authorized: false, error: 'No tienes acceso al módulo de WhatsApp' })
    expect((await POST(request({ file: pdf() }))).status).toBe(403)
    expect(m.create).not.toHaveBeenCalled()
  })

  it('stores the upload with the uploader and returns 201 (KB-11)', async () => {
    const response = await POST(request({ file: pdf(), title: 'Guía EPS' }))

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ success: true, data: { documentId: 'doc-1', queued: true } })
    const call = m.create.mock.calls[0][0]
    expect(call).toMatchObject({ fileName: 'guia.pdf', mimeType: 'application/pdf', title: 'Guía EPS', userId: 'u1' })
    expect(new TextDecoder().decode(call.bytes)).toBe('%PDF-1.4 x')
  })

  it('refuses a body above KB_UPLOAD_MAX_BYTES without parsing it (KB-2)', async () => {
    const response = await POST(request({ file: pdf() }, { 'content-length': String(5 * 1024 * 1024) }))

    expect(response.status).toBe(413)
    expect(m.create).not.toHaveBeenCalled()
  })

  it('maps a rejected file to 400 with its Spanish message', async () => {
    m.create.mockResolvedValue({ ok: false, error: 'Tipo de archivo no soportado. Use PDF, DOCX, TXT o MD.' })

    const response = await POST(request({ file: pdf() }))

    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe('Tipo de archivo no soportado. Use PDF, DOCX, TXT o MD.')
  })

  it('answers 503 when the file could not be stored (a server problem, not a bad file)', async () => {
    m.create.mockResolvedValue({ ok: false, error: 'No se pudo guardar el archivo. Intente de nuevo.' })

    expect((await POST(request({ file: pdf() }))).status).toBe(503)
  })

  it('rejects a request without a file and an oversized title', async () => {
    expect((await POST(request({ title: 'x' }))).status).toBe(400)
    expect((await POST(request({ file: pdf(), title: 'x'.repeat(201) }))).status).toBe(400)
    expect(m.create).not.toHaveBeenCalled()
  })

  it('answers 500 without details when the service throws', async () => {
    m.create.mockRejectedValue(new Error('db down'))

    const response = await POST(request({ file: pdf() }))

    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain('db down')
  })
})
