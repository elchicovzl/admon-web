'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, ClipboardList, FileText, Download, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AffiliationProcessTypeLabels,
  AffiliationStatusLabels,
  AffiliationGlobalStatusLabels,
  SubProcessTypeLabels,
  SubProcessStatusLabels,
  getAffiliationGlobalStatus,
} from '@/lib/types/affiliation.types'
import { ClientSummaryCard } from '@/components/dashboard/client-history/client-summary-card'
import { ClientTimeline } from '@/components/dashboard/client-history/client-timeline'
import { ReactivateClientDialog } from '@/components/dashboard/client-history/reactivate-client-dialog'
import type { ClientHistoryDetail } from '@/lib/types/client-history.types'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface ClientHistoryDetailClientProps {
  detail: ClientHistoryDetail
}

export function ClientHistoryDetailClient({ detail }: ClientHistoryDetailClientProps) {
  const router = useRouter()
  const { client, isDeleted, affiliations, timeline } = detail

  // Aggregate every file the client has: their own documents + all process documents
  const allFiles = [
    ...(client.documents || []).map((doc) => ({
      id: `client-${doc.id}`,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      fileSize: doc.fileSize,
      source: 'Cliente',
      createdAt: doc.createdAt,
      uploadedBy: doc.uploadedBy?.name || doc.uploadedBy?.email || null,
    })),
    ...affiliations.flatMap((aff) =>
      aff.subProcesses.flatMap((sp) =>
        sp.documents.map((doc) => ({
          id: `aff-${doc.id}`,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          fileSize: doc.fileSize,
          source: `${aff.affiliationNumber} · ${SubProcessTypeLabels[sp.type]}`,
          createdAt: doc.createdAt,
          uploadedBy: doc.uploadedBy?.name || doc.uploadedBy?.email || null,
        }))
      )
    ),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/client-history')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{client.fullName}</h1>
              {isDeleted ? (
                <Badge variant="destructive">Eliminado</Badge>
              ) : client.isActive ? (
                <Badge variant="default">Activo</Badge>
              ) : (
                <Badge variant="secondary">Inactivo</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              Cliente desde{' '}
              {format(new Date(client.createdAt), "d 'de' MMMM, yyyy", { locale: es })}
            </p>
          </div>
        </div>

        {isDeleted && (
          <ReactivateClientDialog clientId={client.id} clientName={client.fullName} />
        )}
      </div>

      {/* Summary */}
      <ClientSummaryCard client={client} />

      {/* Tabs */}
      <Tabs defaultValue="processes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="processes">
            <ClipboardList className="mr-2 h-4 w-4" />
            Procesos ({affiliations.length})
          </TabsTrigger>
          <TabsTrigger value="files">
            <FileText className="mr-2 h-4 w-4" />
            Archivos ({allFiles.length})
          </TabsTrigger>
          <TabsTrigger value="activity">Actividad ({timeline.length})</TabsTrigger>
        </TabsList>

        {/* Procesos */}
        <TabsContent value="processes" className="space-y-4">
          {affiliations.length === 0 ? (
            <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
              Este cliente no tiene procesos registrados.
            </div>
          ) : (
            affiliations.map((aff) => {
              const globalStatus = getAffiliationGlobalStatus(aff.subProcesses)
              const processLabel = aff.processType
                ? AffiliationProcessTypeLabels[aff.processType]
                : aff.processTypeOther || 'Sin tipo'

              return (
                <Card key={aff.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Link
                          href={`/dashboard/affiliations/${aff.id}`}
                          className="text-primary hover:underline"
                        >
                          {aff.affiliationNumber}
                        </Link>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">{processLabel}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline">{AffiliationGlobalStatusLabels[globalStatus]}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {AffiliationStatusLabels[aff.status]} ·{' '}
                        {format(new Date(aff.createdAt), 'dd/MM/yyyy', { locale: es })}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {aff.subProcesses.map((sp) => (
                        <div
                          key={sp.id}
                          className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                        >
                          <span className="font-medium">{SubProcessTypeLabels[sp.type]}</span>
                          <span className="text-muted-foreground">
                            {SubProcessStatusLabels[sp.status]}
                          </span>
                        </div>
                      ))}
                    </div>
                    {aff.note && (
                      <p className="mt-3 text-sm text-muted-foreground">{aff.note}</p>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        {/* Archivos */}
        <TabsContent value="files">
          {allFiles.length === 0 ? (
            <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
              No hay archivos asociados a este cliente.
            </div>
          ) : (
            <div className="rounded-lg border divide-y">
              {allFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{file.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.source} · {formatFileSize(file.fileSize)} ·{' '}
                        {format(new Date(file.createdAt), 'dd/MM/yyyy', { locale: es })}
                        {file.uploadedBy ? ` · ${file.uploadedBy}` : ''}
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <a href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Actividad */}
        <TabsContent value="activity">
          <Card>
            <CardContent className="pt-6">
              <ClientTimeline events={timeline} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
