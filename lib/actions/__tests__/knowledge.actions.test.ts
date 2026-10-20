import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '@prisma/client'

const { prismaMock, authMock, hasWhatsAppAccessMock, serviceMock } = vi.hoisted(() => ({
  prismaMock: { knowledgeDocument: { findMany: vi.fn() } },
  authMock: vi.fn(),
  hasWhatsAppAccessMock: vi.fn(),
  serviceMock: {
    deleteKnowledgeDocument: vi.fn(),
    reindexKnowledgeDocument: vi.fn(),
    getKnowledgeHealth: vi.fn(),
  },
}))

vi.mock('@/lib/db/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/auth/auth', () => ({ auth: authMock }))
vi.mock('@/lib/auth/rbac', () => ({ hasWhatsAppAccess: hasWhatsAppAccessMock }))
vi.mock('@/lib/knowledge/documents', () => serviceMock)

import {
  deleteKnowledgeDocument,
  getKnowledgeHealth,
  listKnowledgeDocuments,
  reindexKnowledgeDocument,
} from '../knowledge.actions'

const DOC = 'cjld2cjxh0000qzrmn831i7rn'

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  authMock.mockResolvedValue({ user: { id: 'u1', role: UserRole.MANAGER } })
  hasWhatsAppAccessMock.mockResolvedValue(true)
  prismaMock.knowledgeDocument.findMany.mockResolvedValue([])
  serviceMock.deleteKnowledgeDocument.mockResolvedValue({ ok: true })
  serviceMock.reindexKnowledgeDocument.mockResolvedValue({ ok: true })
  serviceMock.getKnowledgeHealth.mockResolvedValue({ status: 'OK', currentChunks: 3, staleChunks: 0, staleDocuments: 0 })
})

const actions = {
  listKnowledgeDocuments: () => listKnowledgeDocuments(),
  deleteKnowledgeDocument: () => deleteKnowledgeDocument({ documentId: DOC }),
  reindexKnowledgeDocument: () => reindexKnowledgeDocument({ documentId: DOC }),
  getKnowledgeHealth: () => getKnowledgeHealth(),
}

describe('knowledge actions: authorization (S-KB-1, KB-1)', () => {
  for (const [name, run] of Object.entries(actions)) {
    it(`${name} denies a user without WhatsApp access and touches nothing`, async () => {
      hasWhatsAppAccessMock.mockResolvedValue(false)

      expect(await run()).toEqual({ success: false, error: 'No tienes acceso al módulo de WhatsApp' })
      expect(prismaMock.knowledgeDocument.findMany).not.toHaveBeenCalled()
      for (const fn of Object.values(serviceMock)) expect(fn).not.toHaveBeenCalled()
    })

    it(`${name} rejects unauthenticated callers`, async () => {
      authMock.mockResolvedValue(null)

      expect(await run()).toEqual({ success: false, error: 'No autenticado' })
    })

    it(`${name} returns the generic error instead of throwing when the access check fails`, async () => {
      hasWhatsAppAccessMock.mockRejectedValue(new Error('db down'))

      expect(await run()).toEqual({ success: false, error: 'No se pudo completar la operación' })
    })
  }
})

describe('listKnowledgeDocuments', () => {
  it('lists active documents newest first with uploader and timestamps (KB-11)', async () => {
    prismaMock.knowledgeDocument.findMany.mockResolvedValue([
      {
        id: DOC,
        title: 'Guía',
        fileName: 'guia.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        status: 'READY',
        error: null,
        retriable: false,
        chunkCount: 4,
        embeddingModel: 'openai/text-embedding-3-small',
        lastIndexedAt: new Date('2026-10-20T10:05:00Z'),
        createdAt: new Date('2026-10-20T10:00:00Z'),
        updatedAt: new Date('2026-10-20T10:05:00Z'),
        uploadedBy: { name: 'Ana' },
      },
    ])

    const r = await listKnowledgeDocuments()

    expect(prismaMock.knowledgeDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })
    )
    expect(r).toEqual({
      success: true,
      data: [
        {
          id: DOC,
          title: 'Guía',
          fileName: 'guia.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          status: 'READY',
          error: null,
          retriable: false,
          chunkCount: 4,
          embeddingModel: 'openai/text-embedding-3-small',
          lastIndexedAt: '2026-10-20T10:05:00.000Z',
          createdAt: '2026-10-20T10:00:00.000Z',
          updatedAt: '2026-10-20T10:05:00.000Z',
          uploadedByName: 'Ana',
        },
      ],
    })
  })
})

describe('delete and reindex', () => {
  it('deleteKnowledgeDocument delegates and reports the outcome (KB-7)', async () => {
    expect(await deleteKnowledgeDocument({ documentId: DOC })).toEqual({ success: true, data: { id: DOC } })
    expect(serviceMock.deleteKnowledgeDocument).toHaveBeenCalledWith(DOC)

    serviceMock.deleteKnowledgeDocument.mockResolvedValue({ ok: false, error: 'Documento no encontrado' })
    expect(await deleteKnowledgeDocument({ documentId: DOC })).toEqual({ success: false, error: 'Documento no encontrado' })
  })

  it('reindexKnowledgeDocument delegates and reports a run already in progress', async () => {
    expect(await reindexKnowledgeDocument({ documentId: DOC })).toEqual({ success: true, data: { id: DOC } })
    expect(serviceMock.reindexKnowledgeDocument).toHaveBeenCalledWith(DOC)

    serviceMock.reindexKnowledgeDocument.mockResolvedValue({ ok: false, error: 'El documento ya se está indexando.' })
    expect(await reindexKnowledgeDocument({ documentId: DOC })).toEqual({
      success: false,
      error: 'El documento ya se está indexando.',
    })
  })

  it('rejects an invalid document id before touching anything', async () => {
    expect((await deleteKnowledgeDocument({ documentId: 'nope' })).success).toBe(false)
    expect((await reindexKnowledgeDocument({ documentId: 'nope' })).success).toBe(false)
    expect(serviceMock.deleteKnowledgeDocument).not.toHaveBeenCalled()
    expect(serviceMock.reindexKnowledgeDocument).not.toHaveBeenCalled()
  })
})

describe('getKnowledgeHealth (S-KB-8)', () => {
  it('returns the index health', async () => {
    serviceMock.getKnowledgeHealth.mockResolvedValue({ status: 'REINDEX_REQUIRED', currentChunks: 0, staleChunks: 9, staleDocuments: 2 })

    expect(await getKnowledgeHealth()).toEqual({
      success: true,
      data: { status: 'REINDEX_REQUIRED', currentChunks: 0, staleChunks: 9, staleDocuments: 2 },
    })
  })
})
