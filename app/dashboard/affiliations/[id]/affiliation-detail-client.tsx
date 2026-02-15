/**
 * Affiliation Detail Client Component
 * Client-side logic for affiliation detail page
 */

'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp, Mail, Phone, FileText, Key, ExternalLink } from 'lucide-react'
import { SubProcessKanbanCard } from '@/components/dashboard/affiliations/subprocess-kanban-card'
import { ClientCredentialsQuickView } from '@/components/dashboard/affiliations/client-credentials-quick-view'
import type { AffiliationWithRelations, AffiliationSubProcessWithRelations, AffiliationObservationWithRelations } from '@/lib/types/affiliation.types'

const SubProcessDetailModal = dynamic(
  () => import('@/components/dashboard/affiliations/subprocess-detail-modal')
    .then(mod => ({ default: mod.SubProcessDetailModal })),
  { ssr: false }
)

interface AffiliationDetailClientProps {
  affiliation: AffiliationWithRelations
  currentUserId?: string
  currentUserRole?: string
}

export function AffiliationDetailClient({
  affiliation,
  currentUserId,
  currentUserRole,
}: AffiliationDetailClientProps) {
  const [clientInfoOpen, setClientInfoOpen] = useState(false)
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false)
  const [selectedSubProcess, setSelectedSubProcess] = useState<AffiliationSubProcessWithRelations | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [subProcesses, setSubProcesses] = useState<AffiliationSubProcessWithRelations[]>(
    affiliation.subProcesses || []
  )

  function handleSubProcessUpdated(
    subProcessId: string,
    updates: Partial<AffiliationSubProcessWithRelations>
  ) {
    setSubProcesses((prev) =>
      prev.map((sp) => (sp.id === subProcessId ? { ...sp, ...updates } : sp))
    )
  }

  function openSubProcessDetail(subProcess: AffiliationSubProcessWithRelations) {
    setSelectedSubProcess(subProcess)
    setDetailModalOpen(true)
  }

  function handleSubProcessUpdatedFromModal(updates: Partial<AffiliationSubProcessWithRelations>) {
    if (selectedSubProcess) {
      handleSubProcessUpdated(selectedSubProcess.id, updates)
      // Update the selected subprocess in state
      setSelectedSubProcess((prev) => (prev ? { ...prev, ...updates } : null))
    }
  }

  function handleObservationAddedFromModal(observation: AffiliationObservationWithRelations) {
    if (selectedSubProcess) {
      const updated = {
        ...selectedSubProcess,
        observations: [observation, ...(selectedSubProcess.observations || [])],
      }
      setSubProcesses((prev) =>
        prev.map((sp) => (sp.id === selectedSubProcess.id ? updated : sp))
      )
      setSelectedSubProcess(updated)
    }
  }

  function handleObservationDeletedFromModal(observationId: string) {
    if (selectedSubProcess) {
      const updated = {
        ...selectedSubProcess,
        observations: (selectedSubProcess.observations || []).filter((o) => o.id !== observationId),
      }
      setSubProcesses((prev) =>
        prev.map((sp) => (sp.id === selectedSubProcess.id ? updated : sp))
      )
      setSelectedSubProcess(updated)
    }
  }

  function handleDocumentDeletedFromModal(documentId: string) {
    if (selectedSubProcess) {
      const updated = {
        ...selectedSubProcess,
        documents: (selectedSubProcess.documents || []).filter((d) => d.id !== documentId),
      }
      setSubProcesses((prev) =>
        prev.map((sp) => (sp.id === selectedSubProcess.id ? updated : sp))
      )
      setSelectedSubProcess(updated)
    }
  }

  const client = affiliation.client

  return (
    <div className="space-y-6">
      {/* Client Information (Collapsible) */}
      <Collapsible open={clientInfoOpen} onOpenChange={setClientInfoOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Información del Cliente</CardTitle>
                  <CardDescription>
                    Datos de contacto y detalles del cliente
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon">
                  {clientInfoOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Nombre Completo</p>
                  <p className="font-medium">{client?.fullName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Identificación</p>
                  <p className="font-medium">
                    {client?.identificationType} {client?.identificationNumber}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Tipo de Cliente</p>
                  <Badge variant="outline">{client?.clientType}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Email</p>
                    <p className="font-medium">{client?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Teléfono</p>
                    <p className="font-medium">{client?.phone}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={`/dashboard/clients/${client?.id}`}
                    target="_blank"
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Ver Perfil Completo
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCredentialsModalOpen(true)}
                >
                  <Key className="mr-2 h-4 w-4" />
                  Ver Credenciales
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Sub-Processes - Compact Cards */}
      <div className="space-y-4">
        <div className="mb-4">
          <h2 className="text-2xl font-bold">Sub-procesos de Afiliación</h2>
          <p className="text-muted-foreground">
            Haz clic en "Ver Detalles Completos" para gestionar documentos y observaciones
          </p>
        </div>

        {subProcesses.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>No hay sub-procesos configurados para esta afiliación</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subProcesses.map((subProcess) => (
              <SubProcessKanbanCard
                key={subProcess.id}
                subProcess={subProcess}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                onSubProcessUpdated={handleSubProcessUpdated}
                onViewDetails={() => openSubProcessDetail(subProcess)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Affiliation Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Información de la Afiliación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Creada por:</span>
            <span className="font-medium">
              {affiliation.createdBy?.name || affiliation.createdBy?.email}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fecha de creación:</span>
            <span className="font-medium">
              {format(new Date(affiliation.createdAt), "d 'de' MMMM 'de' yyyy", {
                locale: es,
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estado:</span>
            {affiliation.isActive ? (
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                Activa
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">
                Inactiva
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Credentials Quick View Modal */}
      {client && (
        <ClientCredentialsQuickView
          open={credentialsModalOpen}
          onOpenChange={setCredentialsModalOpen}
          clientId={client.id}
          clientName={client.fullName}
        />
      )}

      {/* SubProcess Detail Modal */}
      {selectedSubProcess && (
        <SubProcessDetailModal
          open={detailModalOpen}
          onOpenChange={setDetailModalOpen}
          subProcess={selectedSubProcess}
          clientName={client?.fullName}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          onSubProcessUpdated={handleSubProcessUpdatedFromModal}
          onObservationAdded={handleObservationAddedFromModal}
          onObservationDeleted={handleObservationDeletedFromModal}
          onDocumentDeleted={handleDocumentDeletedFromModal}
        />
      )}
    </div>
  )
}
