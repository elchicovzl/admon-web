'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Loader2,
  Mail,
  Phone,
  IdCard,
  Building2,
  MapPin,
  Briefcase,
  Calendar,
  FileText,
  ExternalLink,
  Key,
  Eye,
  EyeOff,
  User,
  Users,
  SquareArrowOutUpRight,
} from 'lucide-react'
import { IdentificationType } from '@prisma/client'
import { getClientById } from '@/lib/actions/client.actions'
import { revealCredentialPassword } from '@/lib/actions/credential.actions'
import type { ClientWithRelations } from '@/lib/types/client.types'

interface SubProcessClientTabProps {
  clientId: string
  employeeId?: string
  active: boolean
  affiliationId: string
  subProcessId: string
}

function formatUtcDate(date: Date | string): string {
  const d = new Date(date)
  const localized = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return format(localized, 'dd MMM yyyy', { locale: es })
}

const TIPO_RELACION_LABELS: Record<string, { label: string; color: string }> = {
  hijo: { label: 'Hijo/a', color: 'bg-blue-500' },
  padre: { label: 'Padre/Madre', color: 'bg-green-500' },
  conyuge: { label: 'Cónyuge', color: 'bg-pink-500' },
  otro: { label: 'Otro', color: 'bg-gray-500' },
}

const ID_TYPE_SHORT_LABELS: Record<IdentificationType, string> = {
  CEDULA: 'CC',
  TARJETA_IDENTIDAD: 'TI',
  REGISTRO_CIVIL: 'RC',
  CEDULA_EXTRANJERIA: 'CE',
  PASAPORTE: 'PA',
  PPT: 'PPT',
  PEP: 'PEP',
  NUIP: 'NUIP',
  SALVOCONDUCTO: 'SC',
  NIT: 'NIT',
}

export function SubProcessClientTab({
  clientId,
  employeeId,
  active,
  affiliationId,
  subProcessId,
}: SubProcessClientTabProps) {
  const returnQuery = `?returnTo=subprocess&affiliationId=${encodeURIComponent(affiliationId)}&subProcessId=${encodeURIComponent(subProcessId)}`
  const [client, setClient] = useState<ClientWithRelations | null>(null)
  const [employee, setEmployee] = useState<ClientWithRelations | null>(null)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({})
  const [revealingId, setRevealingId] = useState<string | null>(null)

  useEffect(() => {
    if (active && !loaded && clientId) {
      loadData()
    }
  }, [active, loaded, clientId])

  async function loadData() {
    setLoading(true)
    try {
      const clientResult = await getClientById(clientId)
      if (clientResult.success && clientResult.data) {
        setClient(clientResult.data)
      }
      if (employeeId) {
        const empResult = await getClientById(employeeId)
        if (empResult.success && empResult.data) {
          setEmployee(empResult.data)
        }
      }
      setLoaded(true)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleRevealPassword(credentialId: string) {
    if (revealedPasswords[credentialId]) {
      setRevealedPasswords((prev) => {
        const next = { ...prev }
        delete next[credentialId]
        return next
      })
      return
    }

    setRevealingId(credentialId)
    try {
      const result = await revealCredentialPassword(credentialId)
      if (result.success && result.data) {
        setRevealedPasswords((prev) => ({
          ...prev,
          [credentialId]: result.data!.password,
        }))
      }
    } catch (error) {
      console.error('Error revealing password:', error)
    } finally {
      setRevealingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!client) return null

  const isEmpresa = client.clientType === 'EMPRESA'

  const clientTypeLabels: Record<string, string> = {
    EMPLEADO: 'Empleado',
    EMPRESA: 'Empresa',
    INDEPENDIENTE: 'Independiente',
  }

  // Unified card: personal info + administradoras + credentials + legal rep (if empresa)
  function renderPersonCard(person: ClientWithRelations, title: string) {
    const showLegalRep = person.clientType === 'EMPRESA' && person.legalRepresentative
    const hasCredentials = person.credentials && person.credentials.length > 0

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              {title}
            </CardTitle>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                  >
                    <Link
                      href={`/dashboard/clients/${person.id}${returnQuery}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Abrir ${person.fullName} en nueva pestaña`}
                    >
                      <SquareArrowOutUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Abrir cliente</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="space-y-0">
          {/* Personal Info */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="text-muted-foreground">Nombre</div>
            <div className="font-medium">{person.fullName}</div>

            <div className="text-muted-foreground">Tipo</div>
            <div>
              <Badge variant="outline">{clientTypeLabels[person.clientType] || person.clientType}</Badge>
            </div>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <IdCard className="h-3.5 w-3.5" />
              Identificación
            </div>
            <div className="font-medium">{person.identificationType} {person.identificationNumber}</div>

            {person.email && (
              <>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </div>
                <div className="font-medium truncate">{person.email}</div>
              </>
            )}

            {person.phone && (
              <>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  Teléfono
                </div>
                <div className="font-medium">{person.phone}</div>
              </>
            )}
          </div>

          {/* Legal Representative (empresa only) */}
          {showLegalRep && (
            <>
              <Separator className="my-3" />
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Representante Legal
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="text-muted-foreground">Nombre</div>
                <div className="font-medium">{person.legalRepresentative!.fullName}</div>
                <div className="text-muted-foreground">Identificación</div>
                <div className="font-medium">{person.legalRepresentative!.identificationType} {person.legalRepresentative!.identificationNumber}</div>
                {person.legalRepresentative!.email && (
                  <>
                    <div className="text-muted-foreground">Email</div>
                    <div className="font-medium truncate">{person.legalRepresentative!.email}</div>
                  </>
                )}
                {person.legalRepresentative!.phone && (
                  <>
                    <div className="text-muted-foreground">Teléfono</div>
                    <div className="font-medium">{person.legalRepresentative!.phone}</div>
                  </>
                )}
              </div>
            </>
          )}

          {/* Administradoras */}
          <Separator className="my-3" />
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Administradoras
          </p>
          <div className="grid grid-cols-4 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">EPS</span>
              <p className="font-medium text-xs">{person.eps ? person.eps.name : 'No aplica'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">AFP</span>
              <p className="font-medium text-xs">{person.afp ? person.afp.name : 'No aplica'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">ARL</span>
              <p className="font-medium text-xs">
                {person.arl ? person.arl.name : 'No aplica'}
                {person.arl && person.arlRiskLevel && (
                  <span className="text-muted-foreground"> · R{person.arlRiskLevel}</span>
                )}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">CCF</span>
              <p className="font-medium text-xs">{person.ccf ? person.ccf.name : 'No aplica'}</p>
            </div>
          </div>

          {/* Credentials */}
          {hasCredentials && (
            <>
              <Separator className="my-3" />
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5" />
                Credenciales ({person.credentials!.length})
              </p>
              <div className="grid gap-2">
                {person.credentials!.map((cred) => (
                  <div key={cred.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{cred.administratorName}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{cred.administratorType}</Badge>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        <span className="font-mono">{cred.username}</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">
                          {revealedPasswords[cred.id] || '••••••••'}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); handleRevealPassword(cred.id) }}
                          disabled={revealingId === cred.id}
                        >
                          {revealingId === cred.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : revealedPasswords[cred.id] ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Address */}
          {person.address && (
            <>
              <Separator className="my-3" />
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Dirección
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="text-muted-foreground">Departamento</div>
                <div className="font-medium">{person.address.departamento}</div>
                <div className="text-muted-foreground">Municipio</div>
                <div className="font-medium">{person.address.municipio}</div>
                {person.address.ciudad && (
                  <>
                    <div className="text-muted-foreground">Ciudad</div>
                    <div className="font-medium">{person.address.ciudad}</div>
                  </>
                )}
                <div className="text-muted-foreground">Dirección</div>
                <div className="font-medium">{person.address.direccion}</div>
              </div>
            </>
          )}

          {/* Additional Info */}
          {person.additionalInfo && (
            <>
              <Separator className="my-3" />
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" />
                Información Adicional
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {person.additionalInfo.actividadComercial && (
                  <>
                    <div className="text-muted-foreground">Actividad Comercial</div>
                    <div className="font-medium">{person.additionalInfo.actividadComercial}</div>
                  </>
                )}
                {person.additionalInfo.salario != null && (
                  <>
                    <div className="text-muted-foreground">Salario</div>
                    <div className="font-medium">${person.additionalInfo.salario.toLocaleString('es-CO')}</div>
                  </>
                )}
                {person.additionalInfo.fechaIngreso && (
                  <>
                    <div className="text-muted-foreground">Novedad de Ingreso</div>
                    <div className="font-medium">
                      {formatUtcDate(person.additionalInfo.fechaIngreso)}
                    </div>
                  </>
                )}
                {person.additionalInfo.fechaRetiro && (
                  <>
                    <div className="text-muted-foreground">Novedad de Retiro</div>
                    <div className="font-medium">
                      {formatUtcDate(person.additionalInfo.fechaRetiro)}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* Beneficiaries */}
          {person.beneficiaries && person.beneficiaries.length > 0 && (
            <>
              <Separator className="my-3" />
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Beneficiarios ({person.beneficiaries.length})
              </p>
              <div className="grid gap-2">
                {person.beneficiaries.map((b) => {
                  const relacion = TIPO_RELACION_LABELS[b.tipoRelacion] ?? {
                    label: b.tipoRelacion,
                    color: 'bg-gray-500',
                  }
                  return (
                    <div
                      key={b.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge className={`${relacion.color} text-[10px] shrink-0`}>
                          {relacion.label}
                        </Badge>
                        <span className="font-medium truncate">{b.nombreCompleto}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                        <span>{ID_TYPE_SHORT_LABELS[b.identificationType] ?? b.identificationType}</span>
                        <span className="font-mono">{b.identificationNumber}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Documents */}
          {person.documents && person.documents.length > 0 && (
            <>
              <Separator className="my-3" />
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Documentos ({person.documents.length})
              </p>
              <div className="grid gap-2">
                {person.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.fileName}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{doc.category}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {(doc.fileSize / 1024).toFixed(0)} KB
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" asChild>
                      <a href={`/api/documents/${doc.id}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Employee Info (when subprocess has an employee) */}
      {employee && (
        <>
          {renderPersonCard(employee, 'Información del Empleado')}
          <Separator className="my-2" />
        </>
      )}

      {renderPersonCard(client, employee ? 'Información de la Empresa' : 'Información del Cliente')}

    </div>
  )
}
