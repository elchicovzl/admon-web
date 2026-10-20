/**
 * DEV ONLY. Seeds a handful of FAKE WhatsApp conversations so the inbox can be seen locally.
 *
 *   pnpm seed:whatsapp-dev
 *
 * Safety: refuses to run unless DATABASE_URL points at the local development database
 * (localhost:55432, see CLAUDE.md). Never run it against production. Re-running replaces the
 * previous fake data: contacts are identified by the fake wa_id prefix below, and deleting them
 * cascades to their conversations, messages and media.
 */
import { PrismaClient, type ConversationStatus, type Prisma } from '@prisma/client'

const FAKE_PREFIX = '57300555'
const LOCAL_HOST = 'localhost'
const LOCAL_PORT = '55432'

function assertLocalDatabase() {
  const raw = process.env.DATABASE_URL
  if (!raw) throw new Error('DATABASE_URL is not set (use .env.local, see CLAUDE.md).')
  const url = new URL(raw)
  if (url.hostname !== LOCAL_HOST || url.port !== LOCAL_PORT) {
    throw new Error(`Refusing to seed: DATABASE_URL is not ${LOCAL_HOST}:${LOCAL_PORT}.`)
  }
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000)
const hoursAgo = (hours: number) => minutesAgo(hours * 60)

interface FakeMessage {
  direction: 'IN' | 'OUT'
  source: 'CLIENT' | 'AI' | 'DASHBOARD' | 'PHONE_APP' | 'SYSTEM'
  type?: 'TEXT' | 'IMAGE' | 'AUDIO' | 'DOCUMENT'
  text?: string
  at: Date
  status?: 'RECEIVED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
  errorMessage?: string
  media?: Omit<Prisma.WhatsAppMediaUncheckedCreateInput, 'messageId' | 'metaMediaId'>
}

interface FakeConversation {
  suffix: string
  name: string
  status: ConversationStatus
  unread?: number
  aiPaused?: boolean
  escalatedOutOfHours?: boolean
  lead?: 'NEW'
  ambiguous?: boolean
  messages: FakeMessage[]
}

const CONVERSATIONS: FakeConversation[] = [
  {
    suffix: '01',
    name: 'María Gómez (fake)',
    status: 'ESCALATED',
    unread: 2,
    lead: 'NEW',
    messages: [
      { direction: 'IN', source: 'CLIENT', text: 'Hola, necesito afiliarme a una EPS', at: minutesAgo(50) },
      { direction: 'OUT', source: 'AI', text: 'Con gusto. ¿Es empleada o independiente?', at: minutesAgo(49), status: 'READ' },
      { direction: 'IN', source: 'CLIENT', text: 'Quiero hablar con un asesor por favor', at: minutesAgo(20) },
      { direction: 'OUT', source: 'SYSTEM', text: 'Un asesor lo atenderá en breve.', at: minutesAgo(19), status: 'DELIVERED' },
      { direction: 'IN', source: 'CLIENT', text: '¿Alguien me puede ayudar?', at: minutesAgo(5) },
    ],
  },
  {
    suffix: '02',
    name: 'Carlos Ruiz (fake)',
    status: 'ESCALATED',
    escalatedOutOfHours: true,
    unread: 1,
    messages: [
      { direction: 'IN', source: 'CLIENT', text: 'Buenas noches, tengo una queja con mi afiliación', at: hoursAgo(10) },
      { direction: 'OUT', source: 'SYSTEM', text: 'Le responderemos el próximo día hábil a partir de las 8:00 a. m.', at: hoursAgo(10), status: 'READ' },
    ],
  },
  {
    suffix: '03',
    name: 'Ana Torres (fake)',
    status: 'HUMAN',
    messages: [
      { direction: 'IN', source: 'CLIENT', text: 'Adjunto mi cédula', at: hoursAgo(3) },
      {
        direction: 'IN',
        source: 'CLIENT',
        type: 'IMAGE',
        at: hoursAgo(3),
        media: { mimeType: 'image/jpeg', status: 'STORED', s3Key: 'dev-seed/not-a-real-object.jpg' },
      },
      {
        direction: 'IN',
        source: 'CLIENT',
        type: 'AUDIO',
        at: hoursAgo(2),
        media: { mimeType: 'audio/ogg', status: 'STORED', s3Key: 'dev-seed/not-a-real-object.ogg', transcript: 'Buenas tardes, quería confirmar si ya quedó lista mi afiliación.', transcriptStatus: 'DONE' },
      },
      { direction: 'OUT', source: 'PHONE_APP', text: 'Hola Ana, ya revisamos tus documentos.', at: hoursAgo(1), status: 'READ' },
      { direction: 'OUT', source: 'DASHBOARD', text: 'Te confirmo por aquí apenas esté listo.', at: minutesAgo(40), status: 'FAILED', errorMessage: 'Fuera de la ventana de 24 horas' },
    ],
  },
  {
    suffix: '04',
    name: 'Pedro Díaz (fake)',
    status: 'AI',
    aiPaused: true,
    ambiguous: true,
    messages: [
      { direction: 'IN', source: 'CLIENT', text: 'Qué documentos necesito para el RUT?', at: hoursAgo(5) },
      {
        direction: 'IN',
        source: 'CLIENT',
        type: 'DOCUMENT',
        at: hoursAgo(5),
        media: { mimeType: 'application/pdf', fileName: 'soporte.pdf', status: 'FAILED', failureReason: 'dev seed' },
      },
    ],
  },
  {
    suffix: '05',
    name: 'Lucía Mora (fake)',
    status: 'CLOSED',
    messages: [
      { direction: 'IN', source: 'CLIENT', text: 'Gracias, todo resuelto', at: hoursAgo(80) },
      { direction: 'OUT', source: 'DASHBOARD', text: 'A usted. Que tenga un buen día.', at: hoursAgo(79), status: 'READ' },
    ],
  },
]

async function main() {
  assertLocalDatabase()
  const prisma = new PrismaClient()
  try {
    const removed = await prisma.whatsAppContact.deleteMany({ where: { waId: { startsWith: FAKE_PREFIX } } })
    console.log(`Removed ${removed.count} previous fake contact(s).`)

    for (const fake of CONVERSATIONS) {
      const waId = `${FAKE_PREFIX}${fake.suffix}`
      const last = fake.messages[fake.messages.length - 1]
      const lastInbound = [...fake.messages].reverse().find((m) => m.direction === 'IN')
      const escalated = fake.status === 'ESCALATED'

      const contact = await prisma.whatsAppContact.create({
        data: { waId, profileName: fake.name, matchStatus: fake.ambiguous ? 'AMBIGUOUS' : 'UNMATCHED' },
      })
      if (fake.lead) {
        await prisma.lead.create({
          data: { contactId: contact.id, phoneE164: `+${waId}`, displayName: fake.name, status: fake.lead },
        })
      }

      const conversation = await prisma.conversation.create({
        data: {
          contactId: contact.id,
          status: fake.status,
          aiPaused: fake.aiPaused ?? false,
          unreadCount: fake.unread ?? 0,
          lastMessageAt: last.at,
          lastMessagePreview: last.text ?? 'Archivo adjunto',
          lastInboundAt: lastInbound?.at ?? null,
          escalatedAt: escalated ? minutesAgo(20) : null,
          escalatedOutOfHours: fake.escalatedOutOfHours ?? false,
          attentionDueAt: escalated
            ? fake.escalatedOutOfHours
              ? new Date(Date.now() + 36 * 3_600_000)
              : minutesAgo(20)
            : null,
        },
      })

      for (const message of fake.messages) {
        const created = await prisma.whatsAppMessage.create({
          data: {
            conversationId: conversation.id,
            direction: message.direction,
            source: message.source,
            type: message.type ?? 'TEXT',
            text: message.text ?? null,
            status: message.status ?? 'RECEIVED',
            errorMessage: message.errorMessage ?? null,
            timestamp: message.at,
          },
        })
        if (message.media) {
          await prisma.whatsAppMedia.create({
            data: { ...message.media, messageId: created.id, metaMediaId: `dev-seed-${created.id}` },
          })
        }
      }
      console.log(`Seeded ${fake.name} (${fake.status})`)
    }
    console.log('Done. Open /dashboard/whatsapp with a user that has WhatsApp access.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
