'use client'

import { useState } from 'react'
import type { ClientWithRelations, LegalRepresentative } from '@/lib/types/client.types'
import { ClientType, IdentificationType } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  User,
  CreditCard,
  FileText,
  Mail,
  Phone,
  Building2,
  Edit,
  ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'
import { ClientFormDialog } from '@/components/dashboard/clients/client-form-dialog'
import { ClientAddressSection } from '@/components/dashboard/clients/client-address-section'
import { ClientAdditionalInfoSection } from '@/components/dashboard/clients/client-additional-info-section'
import { LegalRepresentativeFormDialog } from '@/components/dashboard/clients/legal-representative-form-dialog'
import { AdministradorasFormDialog } from '@/components/dashboard/clients/administradoras-form-dialog'
import { getClientById } from '@/lib/actions/client.actions'
import type { SafeClient } from '@/lib/types/client.types'

interface ClientInfoPanelProps {
  client: ClientWithRelations
  onClientUpdated: (client: ClientWithRelations) => void
}

const ID_TYPE_LABELS: Record<IdentificationType, string> = {
  CEDULA: 'Cédula (CC)',
  TARJETA_IDENTIDAD: 'Tarjeta Identidad (TI)',
  REGISTRO_CIVIL: 'Registro Civil (RC)',
  CEDULA_EXTRANJERIA: 'Cédula Extranjería (CE)',
  PASAPORTE: 'Pasaporte (PA)',
  PPT: 'PPT',
  PEP: 'PEP',
  NUIP: 'NUIP',
  NIT: 'NIT',
}

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  EMPLEADO: 'Empleado',
  EMPRESA: 'Empresa',
  INDEPENDIENTE: 'Independiente',
}

export function ClientInfoPanel({ client, onClientUpdated }: ClientInfoPanelProps) {
  const [editPersonalOpen, setEditPersonalOpen] = useState(false)
  const [editLegalRepOpen, setEditLegalRepOpen] = useState(false)
  const [editAdministradorasOpen, setEditAdministradorasOpen] = useState(false)
  const [legalRep, setLegalRep] = useState<LegalRepresentative | null>(
    client.legalRepresentative ?? null
  )

  const isEmpresa = client.clientType === ClientType.EMPRESA

  function handleClientUpdated(clientId: string, updates: Partial<SafeClient>) {
    onClientUpdated({ ...client, ...updates } as ClientWithRelations)
  }

  function handleLegalRepUpdated(data: LegalRepresentative) {
    setLegalRep(data)
    onClientUpdated({ ...client, legalRepresentative: data })
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Información del Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 pt-0">

          {/* Información Personal */}
          <div className="py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Información Personal</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditPersonalOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 pl-6">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Nombre Completo</p>
                <p className="text-sm">{client.fullName}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Tipo de Cliente</p>
                <p className="text-sm">{CLIENT_TYPE_LABELS[client.clientType]}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Identificación</p>
                <p className="text-sm">
                  {ID_TYPE_LABELS[client.identificationType]}: {client.identificationNumber}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Status</p>
                <Badge variant={client.isActive ? 'default' : 'destructive'} className="text-xs mt-0.5">
                  {client.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              {client.clientType === ClientType.EMPLEADO && client.company && (
                <div className="col-span-full">
                  <p className="text-xs font-medium text-muted-foreground">Empresa</p>
                  <Link
                    href={`/dashboard/clients/${client.company.id}`}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    {client.company.fullName}
                  </Link>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Información de Contacto */}
          <div className="py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Información de Contacto</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditPersonalOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 pl-6">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Email</p>
                <a
                  href={`mailto:${client.email}`}
                  className="text-sm text-muted-foreground hover:text-primary underline"
                >
                  {client.email}
                </a>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Teléfono</p>
                <a
                  href={`tel:${client.phone}`}
                  className="text-sm text-muted-foreground hover:text-primary underline"
                >
                  {client.phone}
                </a>
              </div>
              {client.createdBy && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Creado por</p>
                  <p className="text-sm text-muted-foreground">
                    {client.createdBy.name || client.createdBy.email}
                  </p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Dirección */}
          <div className="py-3">
            <ClientAddressSection
              clientId={client.id}
              initialAddress={client.address}
              asSection
            />
          </div>

          <Separator />

          {/* Información Adicional */}
          <div className="py-3">
            <ClientAdditionalInfoSection
              clientId={client.id}
              initialInfo={client.additionalInfo}
              asSection
            />
          </div>

          {/* Representante Legal (solo para empresas) */}
          {isEmpresa && (
            <>
              <Separator />
              <div className="py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Representante Legal</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setEditLegalRepOpen(true)}>
                    <Edit className="mr-2 h-4 w-4" />
                    {legalRep ? 'Editar' : 'Agregar'}
                  </Button>
                </div>
                {legalRep ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 pl-6">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Nombre Completo</p>
                      <p className="text-sm">{legalRep.fullName}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Identificación</p>
                      <p className="text-sm">
                        {ID_TYPE_LABELS[legalRep.identificationType]}: {legalRep.identificationNumber}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Email</p>
                      {legalRep.email ? (
                        <a
                          href={`mailto:${legalRep.email}`}
                          className="text-sm text-muted-foreground hover:text-primary underline"
                        >
                          {legalRep.email}
                        </a>
                      ) : (
                        <p className="text-sm text-muted-foreground">—</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Teléfono</p>
                      {legalRep.phone ? (
                        <a
                          href={`tel:${legalRep.phone}`}
                          className="text-sm text-muted-foreground hover:text-primary underline"
                        >
                          {legalRep.phone}
                        </a>
                      ) : (
                        <p className="text-sm text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-1 pl-6">
                    No hay representante legal registrado
                  </p>
                )}
              </div>
            </>
          )}

          {/* Administradoras */}
          <Separator />
          <div className="py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Administradoras</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditAdministradorasOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 pl-6">
              <div>
                <p className="text-xs font-medium text-muted-foreground">EPS</p>
                <p className="text-sm">
                  {client.eps ? `${client.eps.name} (${client.eps.code})` : 'No aplica'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">AFP</p>
                <p className="text-sm">
                  {client.afp ? `${client.afp.name} (${client.afp.code})` : 'No aplica'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">ARL</p>
                <p className="text-sm">
                  {client.arl ? `${client.arl.name} (${client.arl.code})` : 'No aplica'}
                  {client.arl && client.arlRiskLevel && (
                    <span className="ml-1 text-xs text-muted-foreground">· Riesgo {client.arlRiskLevel}</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">CCF</p>
                <p className="text-sm">
                  {client.ccf ? `${client.ccf.name} (${client.ccf.code})` : 'No aplica'}
                </p>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Dialogs */}
      <ClientFormDialog
        open={editPersonalOpen}
        onOpenChange={setEditPersonalOpen}
        editClient={client}
        onClientUpdated={handleClientUpdated}
        redirectOnCreate={false}
      />

      {isEmpresa && (
        <LegalRepresentativeFormDialog
          open={editLegalRepOpen}
          onOpenChange={setEditLegalRepOpen}
          clientId={client.id}
          initialData={legalRep}
          onUpdated={handleLegalRepUpdated}
        />
      )}

      <AdministradorasFormDialog
        open={editAdministradorasOpen}
        onOpenChange={setEditAdministradorasOpen}
        clientId={client.id}
        initialData={{
          eps: client.eps ?? null,
          afp: client.afp ?? null,
          arl: client.arl ?? null,
          arlRiskLevel: client.arlRiskLevel ?? null,
          ccf: client.ccf ?? null,
        }}
        onUpdated={async () => {
          const result = await getClientById(client.id)
          if (result.success && result.data) {
            onClientUpdated(result.data)
          }
        }}
      />
    </>
  )
}
