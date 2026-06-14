import { AffiliationSubProcessStatus } from '@prisma/client'
import { SubProcessTypeLabels, SubProcessStatusLabels } from '@/lib/types/affiliation.types'
import type { ClientWithRelations } from '@/lib/types/client.types'
import type {
  HistoryAffiliation,
  TimelineEvent,
  TimelineVariant,
} from '@/lib/types/client-history.types'

/**
 * Resolve a user's display name (falls back to email).
 */
function actorName(user?: { name: string | null; email: string } | null): string | null {
  if (!user) return null
  return user.name || user.email
}

/**
 * Map a sub-process target status to a timeline color variant.
 */
function statusVariant(status: AffiliationSubProcessStatus): TimelineVariant {
  switch (status) {
    case AffiliationSubProcessStatus.COMPLETED:
      return 'success'
    case AffiliationSubProcessStatus.RETURNED:
      return 'warning'
    case AffiliationSubProcessStatus.IN_PROGRESS:
    case AffiliationSubProcessStatus.IN_REVIEW:
      return 'info'
    default:
      return 'muted'
  }
}

/**
 * Build the unified, chronological activity feed for a client out of data that
 * ALREADY exists across the schema. This is a PURE function: same input → same
 * output, no I/O. The histórico never persists events; it derives them from
 * timestamps on Client, ClientNote, ClientDocument, Affiliation,
 * AffiliationStatusLog, AffiliationDocument, AffiliationObservation and SentEmail.
 *
 * Note: client deletion/reactivation has no dedicated audit row (updatedAt is
 * overwritten), so it intentionally does NOT appear as a timeline event.
 */
export function buildClientTimeline(
  client: ClientWithRelations,
  affiliations: HistoryAffiliation[]
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  // Client created
  events.push({
    id: `client-created-${client.id}`,
    type: 'client_created',
    date: client.createdAt,
    title: 'Cliente creado',
    description: client.fullName,
    actor: actorName(client.createdBy),
    variant: 'default',
  })

  // Client notes
  for (const note of client.notes || []) {
    events.push({
      id: `client-note-${note.id}`,
      type: 'client_note',
      date: note.createdAt,
      title: 'Nota agregada',
      description: note.content,
      actor: actorName(note.createdBy),
      variant: 'muted',
    })
  }

  // Client documents
  for (const doc of client.documents || []) {
    events.push({
      id: `client-doc-${doc.id}`,
      type: 'client_document',
      date: doc.createdAt,
      title: 'Documento del cliente subido',
      description: doc.fileName,
      actor: actorName(doc.uploadedBy),
      variant: 'info',
    })
  }

  // Affiliations and their nested activity
  for (const aff of affiliations) {
    events.push({
      id: `aff-created-${aff.id}`,
      type: 'affiliation_created',
      date: aff.createdAt,
      title: 'Proceso creado',
      description: null,
      actor: actorName(aff.createdBy),
      affiliationNumber: aff.affiliationNumber,
      variant: 'default',
    })

    if (aff.archivedAt) {
      events.push({
        id: `aff-archived-${aff.id}`,
        type: 'affiliation_archived',
        date: aff.archivedAt,
        title: 'Proceso archivado',
        description: null,
        affiliationNumber: aff.affiliationNumber,
        variant: 'muted',
      })
    }

    for (const sp of aff.subProcesses) {
      const typeLabel = SubProcessTypeLabels[sp.type]

      for (const log of sp.statusLogs) {
        events.push({
          id: `sp-log-${log.id}`,
          type: 'subprocess_status',
          date: log.createdAt,
          title: `${typeLabel}: ${SubProcessStatusLabels[log.toStatus]}`,
          description: log.reason,
          actor: actorName(log.changedBy),
          affiliationNumber: aff.affiliationNumber,
          variant: statusVariant(log.toStatus),
        })
      }

      for (const doc of sp.documents) {
        events.push({
          id: `sp-doc-${doc.id}`,
          type: 'affiliation_document',
          date: doc.createdAt,
          title: `Documento ${typeLabel} subido`,
          description: doc.fileName,
          actor: actorName(doc.uploadedBy),
          affiliationNumber: aff.affiliationNumber,
          variant: 'info',
        })
      }

      for (const obs of sp.observations) {
        events.push({
          id: `sp-obs-${obs.id}`,
          type: 'affiliation_observation',
          date: obs.createdAt,
          title: `Observación en ${typeLabel}`,
          description: obs.content,
          actor: actorName(obs.createdBy),
          affiliationNumber: aff.affiliationNumber,
          variant: 'muted',
        })
      }
    }

    for (const email of aff.sentEmails) {
      events.push({
        id: `aff-email-${email.id}`,
        type: 'affiliation_email',
        date: email.sentAt,
        title: 'Email de finalización enviado',
        description: `${email.subject} → ${email.toEmail}`,
        actor: actorName(email.sentBy),
        affiliationNumber: aff.affiliationNumber,
        variant: 'success',
      })
    }
  }

  // Newest first
  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
