'use server'

import { cache } from 'react'
import { auth } from '@/lib/auth/auth'
import prisma from '@/lib/db/prisma'
import { UserRole } from '@prisma/client'
import type { ActionResponse } from '@/lib/types/auth.types'
import type {
  ClientHistoryListItem,
  ClientHistoryDetail,
  HistoryAffiliation,
} from '@/lib/types/client-history.types'
import { getClientById } from '@/lib/actions/client.actions'
import { buildClientTimeline } from '@/lib/utils/client-history-timeline'

/**
 * Check if user has SUPER_ADMIN or MANAGER role
 */
async function requireManagerOrAdmin() {
  const session = await auth()

  if (!session?.user) {
    return { authorized: false, error: 'No autenticado' }
  }

  if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.MANAGER) {
    return { authorized: false, error: 'No tienes permisos para esta acción' }
  }

  return { authorized: true, userId: session.user.id }
}

/**
 * List ALL clients for the histórico — INCLUDING soft-deleted ones.
 * This is the deliberate opposite of getClients(), which filters out
 * status='ELIMINADO'. Here we want the full picture so any deleted client can
 * be inspected and reactivated.
 */
export const getClientHistoryList = cache(
  async (): Promise<ActionResponse<ClientHistoryListItem[]>> => {
    try {
      const authCheck = await requireManagerOrAdmin()
      if (!authCheck.authorized) {
        return { success: false, error: authCheck.error }
      }

      const clients = await prisma.client.findMany({
        select: {
          id: true,
          fullName: true,
          identificationType: true,
          identificationNumber: true,
          clientType: true,
          email: true,
          phone: true,
          status: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          company: {
            select: {
              id: true,
              fullName: true,
            },
          },
          _count: {
            select: {
              affiliations: true,
              documents: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      const data: ClientHistoryListItem[] = clients.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        identificationType: c.identificationType,
        identificationNumber: c.identificationNumber,
        clientType: c.clientType,
        email: c.email,
        phone: c.phone,
        status: c.status,
        isActive: c.isActive,
        isDeleted: c.status === 'ELIMINADO',
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        company: c.company,
        affiliationsCount: c._count.affiliations,
        documentsCount: c._count.documents,
      }))

      return { success: true, data }
    } catch (error) {
      console.error('Get client history list error:', error)
      return { success: false, error: 'Error al obtener el histórico de clientes' }
    }
  }
)

/**
 * Full history aggregation for ONE client: the client with all its relations,
 * all of its processes (affiliations, incl. soft-deleted), and a unified
 * activity timeline derived from everything above.
 *
 * Read-only: no new tables, no duplicated data. Reuses getClientById for the
 * client slice and queries affiliations directly for the process slice.
 */
export const getClientHistory = cache(
  async (id: string): Promise<ActionResponse<ClientHistoryDetail>> => {
    try {
      const authCheck = await requireManagerOrAdmin()
      if (!authCheck.authorized) {
        return { success: false, error: authCheck.error }
      }

      const clientResult = await getClientById(id)
      if (!clientResult.success || !clientResult.data) {
        return { success: false, error: clientResult.error || 'Cliente no encontrado' }
      }
      const client = clientResult.data

      const affiliationsRaw = await prisma.affiliation.findMany({
        where: { clientId: id },
        select: {
          id: true,
          affiliationNumber: true,
          processType: true,
          processTypeOther: true,
          status: true,
          startDate: true,
          sentAt: true,
          archivedAt: true,
          createdAt: true,
          note: true,
          createdBy: { select: { name: true, email: true } },
          subProcesses: {
            select: {
              id: true,
              type: true,
              status: true,
              createdAt: true,
              disabilityStartDate: true,
              disabilityEndDate: true,
              bankRegistry: true,
              transcription: true,
              collection: true,
              paidToUser: true,
              assignedTo: { select: { name: true, email: true } },
              employee: { select: { id: true, fullName: true } },
              documents: {
                select: {
                  id: true,
                  fileName: true,
                  fileUrl: true,
                  fileType: true,
                  fileSize: true,
                  category: true,
                  createdAt: true,
                  uploadedBy: { select: { name: true, email: true } },
                },
                orderBy: { createdAt: 'desc' },
              },
              observations: {
                select: {
                  id: true,
                  content: true,
                  createdAt: true,
                  createdBy: { select: { name: true, email: true } },
                },
                orderBy: { createdAt: 'desc' },
              },
              statusLogs: {
                select: {
                  id: true,
                  fromStatus: true,
                  toStatus: true,
                  reason: true,
                  createdAt: true,
                  changedBy: { select: { name: true, email: true } },
                },
                orderBy: { createdAt: 'desc' },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
          sentEmails: {
            select: {
              id: true,
              toEmail: true,
              subject: true,
              sentAt: true,
              sentBy: { select: { name: true, email: true } },
            },
            orderBy: { sentAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      const affiliations = affiliationsRaw as HistoryAffiliation[]
      const timeline = buildClientTimeline(client, affiliations)

      return {
        success: true,
        data: {
          client,
          isDeleted: client.status === 'ELIMINADO',
          affiliations,
          timeline,
        },
      }
    } catch (error) {
      console.error('Get client history error:', error)
      return { success: false, error: 'Error al obtener el histórico del cliente' }
    }
  }
)
