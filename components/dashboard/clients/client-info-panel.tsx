'use client'

import { useState } from 'react'
import type {
  ClientWithRelations,
  LegalRepresentative,
  ClientAddress,
  ClientAdditionalInfo,
} from '@/lib/types/client.types'
import { ClientType, IdentificationType, EmployeeType, WorkDaysRange } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  User,
  FileText,
  Phone,
  Building2,
  Edit,
  ShieldCheck,
  MapPin,
  Briefcase,
} from 'lucide-react'
import Link from 'next/link'
import { ClientFormDialog } from '@/components/dashboard/clients/client-form-dialog'
import { LegalRepresentativeFormDialog } from '@/components/dashboard/clients/legal-representative-form-dialog'
import { AdministradorasFormDialog } from '@/components/dashboard/clients/administradoras-form-dialog'
import { getClientById } from '@/lib/actions/client.actions'
import { getDepartamentoLabel } from '@/lib/data/colombia-geo'
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
  SALVOCONDUCTO: 'Salvoconducto',
  NIT: 'NIT',
}

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  EMPLEADO: 'Empleado',
  EMPRESA: 'Empresa',
  INDEPENDIENTE: 'Independiente',
}

const EMPLOYEE_TYPE_LABELS: Record<EmployeeType, string> = {
  TIEMPO_COMPLETO: 'Tiempo completo',
  TIEMPO_PARCIAL: 'Tiempo parcial',
  INDEPENDIENTE_CONTRATISTA: 'Independiente Contratista',
}

const WORK_DAYS_LABELS: Record<WorkDaysRange, string> = {
  DIAS_1_7: '1 a 7 días al mes',
  DIAS_8_14: '8 a 14 días al mes',
  DIAS_15_21: '15 a 21 días al mes',
  DIAS_22_30: '22 a 30 días al mes',
}

function formatDate(date?: Date | null): string {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatCurrency(value?: number | null): string {
  if (!value) return 'No especificado'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)
}

export function ClientInfoPanel({ client, onClientUpdated }: ClientInfoPanelProps) {
  const [editClientOpen, setEditClientOpen] = useState(false)
  const [editLegalRepOpen, setEditLegalRepOpen] = useState(false)
  const [editAdministradorasOpen, setEditAdministradorasOpen] = useState(false)
  const [legalRep, setLegalRep] = useState<LegalRepresentative | null>(
    client.legalRepresentative ?? null
  )
  const [address, setAddress] = useState<ClientAddress | null>(client.address ?? null)
  const [additionalInfo, setAdditionalInfo] = useState<ClientAdditionalInfo | null>(
    client.additionalInfo ?? null
  )

  const isEmpresa = client.clientType === ClientType.EMPRESA

  function handleClientUpdated(clientId: string, updates: Partial<SafeClient>) {
    onClientUpdated({ ...client, ...updates } as ClientWithRelations)
  }

  function handleContactInfoUpdated(updates: {
    address?: ClientAddress | null
    additionalInfo?: ClientAdditionalInfo | null
  }) {
    const next: Partial<ClientWithRelations> = {}
    if (updates.address !== undefined) {
      setAddress(updates.address)
      next.address = updates.address
    }
    if (updates.additionalInfo !== undefined) {
      setAdditionalInfo(updates.additionalInfo)
      next.additionalInfo = updates.additionalInfo
    }
    if (Object.keys(next).length > 0) {
      onClientUpdated({ ...client, ...next } as ClientWithRelations)
    }
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
              <Button size="sm" variant="ghost" onClick={() => setEditClientOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 pl-6">
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
              {/* Employment info: list of active employments from join table */}
              {client.employmentsAsEmployee && client.employmentsAsEmployee.length > 0 && (
                <div className="col-span-full">
                  <p className="text-xs font-medium text-muted-foreground">
                    {client.employmentsAsEmployee.length === 1 ? 'Empresa' : 'Empresas'}
                  </p>
                  <div className="flex flex-col gap-1 mt-1">
                    {client.employmentsAsEmployee.map((emp) => (
                      <div key={emp.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <Link
                          href={`/dashboard/clients/${emp.company.id}`}
                          className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          <Building2 className="h-3.5 w-3.5" />
                          {emp.company.fullName}
                        </Link>
                        {emp.employeeType && (
                          <span className="text-xs text-muted-foreground">
                            · {EMPLOYEE_TYPE_LABELS[emp.employeeType]}
                          </span>
                        )}
                        {emp.workDaysRange && (
                          <span className="text-xs text-muted-foreground">
                            · {WORK_DAYS_LABELS[emp.workDaysRange]}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Fallback: shadow column — only shown when no Employment rows exist (legacy clients) */}
              {(!client.employmentsAsEmployee || client.employmentsAsEmployee.length === 0) &&
                client.clientType === ClientType.EMPLEADO &&
                client.company && (
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

          {/* Información de Contacto (incluye Dirección + Información Adicional) */}
          <div className="py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Información de Contacto</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditClientOpen(true)}>
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

            {/* Dirección (subsección) */}
            <div className="mt-4 pl-6">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Dirección
                </p>
              </div>
              {address ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Departamento</p>
                    <p className="text-sm">{getDepartamentoLabel(address.departamento)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Municipio</p>
                    <p className="text-sm">{address.municipio}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Barrio</p>
                    <p className="text-sm">{address.ciudad || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Dirección</p>
                    <p className="text-sm">{address.direccion}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No hay dirección registrada</p>
              )}
            </div>

            {/* Información Adicional (subsección) */}
            <div className="mt-4 pl-6">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Información del Contrato
                </p>
              </div>
              {additionalInfo ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
                  <div className="col-span-2">
                    <p className="text-xs font-medium text-muted-foreground">Actividad Comercial</p>
                    <p className="text-sm">{additionalInfo.actividadComercial || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Salario</p>
                    <p className="text-sm font-semibold">{formatCurrency(additionalInfo.salario)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Novedad de Ingreso</p>
                    <p className="text-sm">{formatDate(additionalInfo.fechaIngreso)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Novedad de Retiro</p>
                    <p className="text-sm">{formatDate(additionalInfo.fechaRetiro)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No hay información del contrato registrada</p>
              )}
            </div>
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
        open={editClientOpen}
        onOpenChange={setEditClientOpen}
        editClient={client}
        editAddress={address}
        editAdditionalInfo={additionalInfo}
        onClientUpdated={handleClientUpdated}
        onContactInfoUpdated={handleContactInfoUpdated}
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
