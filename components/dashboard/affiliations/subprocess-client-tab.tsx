'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  Users,
  Eye,
  EyeOff,
  User,
} from 'lucide-react'
import { getClientById } from '@/lib/actions/client.actions'
import { revealCredentialPassword } from '@/lib/actions/credential.actions'
import { EmployeeDetailSheet } from './employee-detail-sheet'
import type { ClientWithRelations } from '@/lib/types/client.types'

interface SubProcessClientTabProps {
  clientId: string
  active: boolean
}

export function SubProcessClientTab({ clientId, active }: SubProcessClientTabProps) {
  const [client, setClient] = useState<ClientWithRelations | null>(null)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [employeeSheetOpen, setEmployeeSheetOpen] = useState(false)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({})
  const [revealingId, setRevealingId] = useState<string | null>(null)

  useEffect(() => {
    if (active && !loaded && clientId) {
      loadClient()
    }
  }, [active, loaded, clientId])

  async function loadClient() {
    setLoading(true)
    try {
      const result = await getClientById(clientId)
      if (result.success && result.data) {
        setClient(result.data)
        setLoaded(true)
      }
    } catch (error) {
      console.error('Error loading client:', error)
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

  function handleEmployeeClick(employeeId: string) {
    setSelectedEmployeeId(employeeId)
    setEmployeeSheetOpen(true)
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
  const hasEmployees = isEmpresa && client.employees && client.employees.length > 0

  const clientTypeLabels: Record<string, string> = {
    EMPLEADO: 'Empleado',
    EMPRESA: 'Empresa',
    INDEPENDIENTE: 'Independiente',
  }

  return (
    <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-200px)] pr-1">
      {/* Personal Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4" />
            Información del Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="text-muted-foreground">Nombre</div>
            <div className="font-medium">{client.fullName}</div>

            <div className="text-muted-foreground">Tipo</div>
            <div>
              <Badge variant="outline">{clientTypeLabels[client.clientType] || client.clientType}</Badge>
            </div>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <IdCard className="h-3.5 w-3.5" />
              Identificación
            </div>
            <div className="font-medium">{client.identificationType} {client.identificationNumber}</div>

            {client.email && (
              <>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </div>
                <div className="font-medium truncate">{client.email}</div>
              </>
            )}

            {client.phone && (
              <>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  Teléfono
                </div>
                <div className="font-medium">{client.phone}</div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      {client.address && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Dirección
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="text-muted-foreground">Departamento</div>
              <div className="font-medium">{client.address.departamento}</div>

              <div className="text-muted-foreground">Municipio</div>
              <div className="font-medium">{client.address.municipio}</div>

              {client.address.ciudad && (
                <>
                  <div className="text-muted-foreground">Ciudad</div>
                  <div className="font-medium">{client.address.ciudad}</div>
                </>
              )}

              <div className="text-muted-foreground">Dirección</div>
              <div className="font-medium">{client.address.direccion}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional Info */}
      {client.additionalInfo && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Información Adicional
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {client.additionalInfo.actividadComercial && (
                <>
                  <div className="text-muted-foreground">Actividad Comercial</div>
                  <div className="font-medium">{client.additionalInfo.actividadComercial}</div>
                </>
              )}

              {client.additionalInfo.salario != null && (
                <>
                  <div className="text-muted-foreground">Salario</div>
                  <div className="font-medium">${client.additionalInfo.salario.toLocaleString('es-CO')}</div>
                </>
              )}

              {client.additionalInfo.fechaIngreso && (
                <>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Fecha Ingreso
                  </div>
                  <div className="font-medium">
                    {format(new Date(client.additionalInfo.fechaIngreso), 'dd MMM yyyy', { locale: es })}
                  </div>
                </>
              )}

              {client.additionalInfo.fechaRetiro && (
                <>
                  <div className="text-muted-foreground">Fecha Retiro</div>
                  <div className="font-medium">
                    {format(new Date(client.additionalInfo.fechaRetiro), 'dd MMM yyyy', { locale: es })}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legal Representative (EMPRESA only) */}
      {isEmpresa && client.legalRepresentative && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              Representante Legal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="text-muted-foreground">Nombre</div>
              <div className="font-medium">{client.legalRepresentative.fullName}</div>

              <div className="text-muted-foreground">Identificación</div>
              <div className="font-medium">
                {client.legalRepresentative.identificationType} {client.legalRepresentative.identificationNumber}
              </div>

              {client.legalRepresentative.email && (
                <>
                  <div className="text-muted-foreground">Email</div>
                  <div className="font-medium truncate">{client.legalRepresentative.email}</div>
                </>
              )}

              {client.legalRepresentative.phone && (
                <>
                  <div className="text-muted-foreground">Teléfono</div>
                  <div className="font-medium">{client.legalRepresentative.phone}</div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Credentials */}
      {client.credentials && client.credentials.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Key className="h-4 w-4" />
              Credenciales ({client.credentials.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {client.credentials.map((cred) => (
                <div key={cred.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{cred.administratorName}</div>
                    <Badge variant="outline" className="text-[10px]">{cred.administratorType}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div className="text-muted-foreground">Usuario</div>
                    <div className="font-mono text-xs">{cred.username}</div>

                    <div className="text-muted-foreground">Contraseña</div>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs">
                        {revealedPasswords[cred.id] || '••••••••'}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRevealPassword(cred.id)}
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

                    {cred.portalUrl && (
                      <>
                        <div className="text-muted-foreground">Portal</div>
                        <a
                          href={cred.portalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline truncate"
                        >
                          {cred.portalUrl}
                        </a>
                      </>
                    )}
                  </div>
                  {cred.notes && (
                    <p className="text-xs text-muted-foreground mt-1">{cred.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      {client.documents && client.documents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentos ({client.documents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {client.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-md border p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.fileName}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{doc.category}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {(doc.fileSize / 1024).toFixed(0)} KB
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" asChild>
                    <a href={`/api/documents/${doc.id}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employees (EMPRESA only) */}
      {hasEmployees && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Empleados ({client.employees!.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Nombre</TableHead>
                  <TableHead className="text-xs">Identificación</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.employees!.map((emp) => (
                  <TableRow
                    key={emp.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleEmployeeClick(emp.id)}
                  >
                    <TableCell className="text-sm font-medium">{emp.fullName}</TableCell>
                    <TableCell className="text-sm">{emp.identificationNumber}</TableCell>
                    <TableCell className="text-sm truncate max-w-[150px]">{emp.email}</TableCell>
                    <TableCell>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Employee Detail Sheet */}
      {selectedEmployeeId && (
        <EmployeeDetailSheet
          open={employeeSheetOpen}
          onOpenChange={setEmployeeSheetOpen}
          employeeId={selectedEmployeeId}
        />
      )}
    </div>
  )
}
