import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  userFindUnique: vi.fn(),
  subProcessFindUnique: vi.fn(),
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  updateMany: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({
  default: {
    user: { findUnique: m.userFindUnique },
    affiliationSubProcess: { findUnique: m.subProcessFindUnique },
    processAttentionRequest: {
      create: m.create,
      findUnique: m.findUnique,
      findMany: m.findMany,
      count: m.count,
      updateMany: m.updateMany,
    },
  },
}))
vi.mock('@/lib/auth/auth', () => ({ auth: m.auth }))
vi.mock('next/cache', () => ({ revalidatePath: m.revalidatePath }))

import {
  getAttentionFeed,
  listSubProcessAttentionRequests,
  markAllAttentionRead,
  markAttentionRead,
  replyAttentionRequest,
  sendAttentionRequest,
} from '../attention-request.actions'

const SUB = 'cjld2cjxh0000qzrmn831i7rn'
const REQ = 'cjld2cjxh0001qzrmn831i7rn'
const AFF = 'aff-1'
const SUB_URL = `/dashboard/affiliations/${AFF}/subprocess/${SUB}`

const subProcessRef = {
  id: SUB,
  type: 'ARL',
  affiliationId: AFF,
  affiliation: { client: { fullName: 'Juan Pérez' } },
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  m.auth.mockResolvedValue({ user: { id: 'me' } })
  m.userFindUnique.mockResolvedValue({ isActive: true })
  m.subProcessFindUnique.mockResolvedValue({
    id: SUB,
    affiliationId: AFF,
    assignedToId: 'assignee',
    assignedTo: { isActive: true },
  })
  m.create.mockResolvedValue({ id: REQ })
  m.findMany.mockResolvedValue([])
  m.count.mockResolvedValue(0)
  m.updateMany.mockResolvedValue({ count: 1 })
})

const everyAction: Array<[string, () => Promise<{ success: boolean; error?: string }>]> = [
  ['sendAttentionRequest', () => sendAttentionRequest({ subProcessId: SUB, message: 'hola' })],
  ['replyAttentionRequest', () => replyAttentionRequest({ id: REQ, reply: 'listo' })],
  ['getAttentionFeed', () => getAttentionFeed()],
  ['markAttentionRead', () => markAttentionRead({ id: REQ })],
  ['markAllAttentionRead', () => markAllAttentionRead()],
  ['listSubProcessAttentionRequests', () => listSubProcessAttentionRequests({ subProcessId: SUB })],
]

describe.each(everyAction)('%s: authorization (S2)', (_name, run) => {
  it('rejects unauthenticated callers without touching attention requests', async () => {
    m.auth.mockResolvedValue(null)

    await expect(run()).resolves.toEqual({ success: false, error: 'No autenticado' })
    expect(m.create).not.toHaveBeenCalled()
    expect(m.findMany).not.toHaveBeenCalled()
    expect(m.updateMany).not.toHaveBeenCalled()
  })

  it('rejects an inactive user (checked in the DB, not the token)', async () => {
    m.userFindUnique.mockResolvedValue({ isActive: false })

    await expect(run()).resolves.toEqual({ success: false, error: 'Usuario inactivo' })
    expect(m.userFindUnique).toHaveBeenCalledWith({ where: { id: 'me' }, select: { isActive: true } })
    expect(m.create).not.toHaveBeenCalled()
    expect(m.updateMany).not.toHaveBeenCalled()
  })
})

describe('sendAttentionRequest (S2, S5)', () => {
  it('creates a request for the sub-process assignee and revalidates the sub-process page', async () => {
    const result = await sendAttentionRequest({ subProcessId: SUB, message: '  El cliente escribió  ' })

    expect(result).toEqual({ success: true, data: { id: REQ }, message: 'Solicitud enviada al responsable' })
    expect(m.create).toHaveBeenCalledWith({
      data: { subProcessId: SUB, senderId: 'me', recipientId: 'assignee', message: 'El cliente escribió' },
      select: { id: true },
    })
    expect(m.revalidatePath).toHaveBeenCalledWith(SUB_URL)
  })

  it.each([
    ['an empty message', { subProcessId: SUB, message: '   ' }, 'El mensaje es requerido'],
    ['a message over 1000 characters', { subProcessId: SUB, message: 'a'.repeat(1001) }, 'El texto no puede superar 1000 caracteres'],
    ['an invalid sub-process id', { subProcessId: 'x', message: 'hola' }, 'Sub-proceso inválido'],
  ])('rejects %s', async (_case, input, error) => {
    await expect(sendAttentionRequest(input)).resolves.toEqual({ success: false, error })
    expect(m.create).not.toHaveBeenCalled()
  })

  it('rejects a missing sub-process', async () => {
    m.subProcessFindUnique.mockResolvedValue(null)

    await expect(sendAttentionRequest({ subProcessId: SUB, message: 'hola' })).resolves.toEqual({
      success: false,
      error: 'Sub-proceso no encontrado',
    })
    expect(m.create).not.toHaveBeenCalled()
  })

  it('rejects a sub-process without assignee', async () => {
    m.subProcessFindUnique.mockResolvedValue({ id: SUB, affiliationId: AFF, assignedToId: null, assignedTo: null })

    await expect(sendAttentionRequest({ subProcessId: SUB, message: 'hola' })).resolves.toEqual({
      success: false,
      error: 'Este sub-proceso no tiene responsable asignado',
    })
    expect(m.create).not.toHaveBeenCalled()
  })

  it('rejects an inactive assignee', async () => {
    m.subProcessFindUnique.mockResolvedValue({
      id: SUB,
      affiliationId: AFF,
      assignedToId: 'assignee',
      assignedTo: { isActive: false },
    })

    await expect(sendAttentionRequest({ subProcessId: SUB, message: 'hola' })).resolves.toEqual({
      success: false,
      error: 'El responsable de este sub-proceso está inactivo',
    })
    expect(m.create).not.toHaveBeenCalled()
  })

  it('rejects when the sender is the assignee', async () => {
    m.subProcessFindUnique.mockResolvedValue({
      id: SUB,
      affiliationId: AFF,
      assignedToId: 'me',
      assignedTo: { isActive: true },
    })

    await expect(sendAttentionRequest({ subProcessId: SUB, message: 'hola' })).resolves.toEqual({
      success: false,
      error: 'Eres el responsable de este sub-proceso',
    })
    expect(m.create).not.toHaveBeenCalled()
  })
})

describe('replyAttentionRequest (S4)', () => {
  beforeEach(() => {
    m.findUnique.mockResolvedValue({ recipientId: 'me', reply: null, subProcess: { id: SUB, affiliationId: AFF } })
  })

  it('stores the reply once, marks the request read and revalidates the sub-process page', async () => {
    const result = await replyAttentionRequest({ id: REQ, reply: ' Ya lo llamo ' })

    expect(result).toEqual({ success: true, message: 'Respuesta enviada' })
    expect(m.updateMany).toHaveBeenCalledWith({
      where: { id: REQ, recipientId: 'me', reply: null },
      data: { reply: 'Ya lo llamo', repliedAt: expect.any(Date), readAt: expect.any(Date) },
    })
    expect(m.revalidatePath).toHaveBeenCalledWith(SUB_URL)
  })

  it('hides requests addressed to somebody else', async () => {
    m.findUnique.mockResolvedValue({ recipientId: 'other', reply: null, subProcess: { id: SUB, affiliationId: AFF } })

    await expect(replyAttentionRequest({ id: REQ, reply: 'x' })).resolves.toEqual({
      success: false,
      error: 'Solicitud no encontrada',
    })
    expect(m.updateMany).not.toHaveBeenCalled()
  })

  it('rejects a missing request', async () => {
    m.findUnique.mockResolvedValue(null)

    await expect(replyAttentionRequest({ id: REQ, reply: 'x' })).resolves.toEqual({
      success: false,
      error: 'Solicitud no encontrada',
    })
  })

  it('rejects a second reply', async () => {
    m.findUnique.mockResolvedValue({ recipientId: 'me', reply: 'antes', subProcess: { id: SUB, affiliationId: AFF } })

    await expect(replyAttentionRequest({ id: REQ, reply: 'x' })).resolves.toEqual({
      success: false,
      error: 'Esta solicitud ya fue respondida',
    })
    expect(m.updateMany).not.toHaveBeenCalled()
  })

  it('rejects a reply that lost the race against another reply', async () => {
    m.updateMany.mockResolvedValue({ count: 0 })

    await expect(replyAttentionRequest({ id: REQ, reply: 'x' })).resolves.toEqual({
      success: false,
      error: 'Esta solicitud ya fue respondida',
    })
    expect(m.revalidatePath).not.toHaveBeenCalled()
  })

  it('rejects an empty reply', async () => {
    await expect(replyAttentionRequest({ id: REQ, reply: ' ' })).resolves.toEqual({
      success: false,
      error: 'La respuesta es requerida',
    })
    expect(m.findUnique).not.toHaveBeenCalled()
  })
})

describe('getAttentionFeed (S3, S4, S5)', () => {
  const base = {
    message: 'El cliente escribió',
    sender: { name: 'Laura', email: 'laura@x.co' },
    recipient: { name: null, email: 'pedro@x.co' },
    subProcess: subProcessRef,
  }

  it('merges requests to me and replies to my requests, newest first, with the unread total', async () => {
    m.findMany
      .mockResolvedValueOnce([
        { ...base, id: 'in-1', reply: null, repliedAt: null, readAt: null, replyReadAt: null, createdAt: new Date('2026-11-20T10:00:00Z') },
      ])
      .mockResolvedValueOnce([
        { ...base, id: 'out-1', reply: 'Listo', repliedAt: new Date('2026-11-20T11:00:00Z'), readAt: new Date(), replyReadAt: new Date(), createdAt: new Date('2026-11-20T09:00:00Z') },
      ])
    m.count.mockResolvedValueOnce(1).mockResolvedValueOnce(2)

    const result = await getAttentionFeed()

    expect(m.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { recipientId: 'me' }, take: 20 }))
    expect(m.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { senderId: 'me', repliedAt: { not: null } }, take: 20 })
    )
    expect(m.count).toHaveBeenNthCalledWith(1, { where: { recipientId: 'me', readAt: null } })
    expect(m.count).toHaveBeenNthCalledWith(2, { where: { senderId: 'me', repliedAt: { not: null }, replyReadAt: null } })
    expect(result).toEqual({
      success: true,
      data: {
        unreadCount: 3,
        items: [
          {
            id: 'out-1',
            kind: 'REPLY',
            read: true,
            eventAt: new Date('2026-11-20T11:00:00Z'),
            counterpartName: 'pedro@x.co',
            subProcessLabel: 'ARL · Juan Pérez',
            link: SUB_URL,
            message: 'El cliente escribió',
            reply: 'Listo',
            canReply: false,
          },
          {
            id: 'in-1',
            kind: 'REQUEST',
            read: false,
            eventAt: new Date('2026-11-20T10:00:00Z'),
            counterpartName: 'Laura',
            subProcessLabel: 'ARL · Juan Pérez',
            link: SUB_URL,
            message: 'El cliente escribió',
            reply: null,
            canReply: true,
          },
        ],
      },
    })
  })
})

describe('markAttentionRead / markAllAttentionRead', () => {
  it('marks only my side of one request: received as read, reply as seen', async () => {
    await expect(markAttentionRead({ id: REQ })).resolves.toEqual({ success: true })

    expect(m.updateMany).toHaveBeenCalledWith({
      where: { id: REQ, recipientId: 'me', readAt: null },
      data: { readAt: expect.any(Date) },
    })
    expect(m.updateMany).toHaveBeenCalledWith({
      where: { id: REQ, senderId: 'me', repliedAt: { not: null }, replyReadAt: null },
      data: { replyReadAt: expect.any(Date) },
    })
  })

  it('marks everything of mine as read', async () => {
    await expect(markAllAttentionRead()).resolves.toEqual({ success: true })

    expect(m.updateMany).toHaveBeenCalledWith({
      where: { recipientId: 'me', readAt: null },
      data: { readAt: expect.any(Date) },
    })
    expect(m.updateMany).toHaveBeenCalledWith({
      where: { senderId: 'me', repliedAt: { not: null }, replyReadAt: null },
      data: { replyReadAt: expect.any(Date) },
    })
  })

  it('rejects an invalid id', async () => {
    await expect(markAttentionRead({ id: 'x' })).resolves.toEqual({ success: false, error: 'Solicitud inválida' })
    expect(m.updateMany).not.toHaveBeenCalled()
  })
})

describe('listSubProcessAttentionRequests (S6)', () => {
  it('returns the history of one sub-process with status', async () => {
    const createdAt = new Date('2026-11-20T10:00:00Z')
    const repliedAt = new Date('2026-11-20T10:30:00Z')
    m.findMany.mockResolvedValue([
      {
        id: 'r1',
        message: 'Atiende al cliente',
        reply: 'Hecho',
        createdAt,
        repliedAt,
        sender: { name: 'Laura', email: 'laura@x.co' },
        recipient: { name: 'Pedro', email: 'pedro@x.co' },
      },
      {
        id: 'r2',
        message: 'Otra vez',
        reply: null,
        createdAt,
        repliedAt: null,
        sender: { name: null, email: 'laura@x.co' },
        recipient: { name: 'Pedro', email: 'pedro@x.co' },
      },
    ])

    const result = await listSubProcessAttentionRequests({ subProcessId: SUB })

    expect(m.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { subProcessId: SUB }, orderBy: { createdAt: 'desc' } })
    )
    expect(result).toEqual({
      success: true,
      data: [
        { id: 'r1', senderName: 'Laura', recipientName: 'Pedro', message: 'Atiende al cliente', reply: 'Hecho', status: 'ANSWERED', createdAt, repliedAt },
        { id: 'r2', senderName: 'laura@x.co', recipientName: 'Pedro', message: 'Otra vez', reply: null, status: 'PENDING', createdAt, repliedAt: null },
      ],
    })
  })
})
