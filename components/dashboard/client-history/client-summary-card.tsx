import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ClientType, IdentificationType } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Mail,
  Phone,
  IdCard,
  MapPin,
  Building2,
  ShieldCheck,
} from 'lucide-react'
import type { ClientWithRelations } from '@/lib/types/client.types'

const identificationTypeLabels: Record<IdentificationType, string> = {
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

const clientTypeLabels: Record<ClientType, string> = {
  EMPLEADO: 'Empleado',
  EMPRESA: 'Empresa',
  INDEPENDIENTE: 'Independiente',
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm">{value || '—'}</p>
    </div>
  )
}

interface ClientSummaryCardProps {
  client: ClientWithRelations
}

export function ClientSummaryCard({ client }: ClientSummaryCardProps) {
  const admins = [
    { label: 'EPS', value: client.eps?.name },
    { label: 'AFP', value: client.afp?.name },
    {
      label: 'ARL',
      value: client.arl
        ? `${client.arl.name}${client.arlRiskLevel ? ` (Riesgo ${client.arlRiskLevel})` : ''}`
        : null,
    },
    { label: 'CCF', value: client.ccf?.name },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resumen del cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Identification & type */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Identificación"
            value={
              <span className="inline-flex items-center gap-1.5">
                <IdCard className="h-3.5 w-3.5 text-muted-foreground" />
                {identificationTypeLabels[client.identificationType]} {client.identificationNumber}
              </span>
            }
          />
          <Field label="Tipo de cliente" value={clientTypeLabels[client.clientType]} />
          <Field
            label="Email"
            value={
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                {client.email}
              </span>
            }
          />
          <Field
            label="Teléfono"
            value={
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                {client.phone}
              </span>
            }
          />
        </div>

        {/* Administradoras */}
        <Separator />
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Seguridad social
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {admins.map((a) => (
              <Field key={a.label} label={a.label} value={a.value} />
            ))}
          </div>
        </div>

        {/* Address */}
        {client.address && (
          <>
            <Separator />
            <Field
              label="Dirección"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {[
                    client.address.direccion,
                    client.address.ciudad,
                    client.address.municipio,
                    client.address.departamento,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              }
            />
          </>
        )}

        {/* Additional info */}
        {client.additionalInfo && (
          <>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field
                label="Actividad comercial"
                value={client.additionalInfo.actividadComercial}
              />
              <Field
                label="Salario"
                value={
                  client.additionalInfo.salario != null
                    ? `$ ${client.additionalInfo.salario.toLocaleString('es-CO')}`
                    : null
                }
              />
              <Field
                label="Fecha de ingreso"
                value={
                  client.additionalInfo.fechaIngreso
                    ? format(new Date(client.additionalInfo.fechaIngreso), 'dd/MM/yyyy', {
                        locale: es,
                      })
                    : null
                }
              />
              <Field
                label="Fecha de retiro"
                value={
                  client.additionalInfo.fechaRetiro
                    ? format(new Date(client.additionalInfo.fechaRetiro), 'dd/MM/yyyy', {
                        locale: es,
                      })
                    : null
                }
              />
            </div>
          </>
        )}

        {/* Company relation (for employees) */}
        {client.company && (
          <>
            <Separator />
            <Field
              label="Empresa"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  {client.company.fullName}
                </span>
              }
            />
          </>
        )}

        {/* Legal representative (for companies) */}
        {client.legalRepresentative && (
          <>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Rep. legal" value={client.legalRepresentative.fullName} />
              <Field
                label="Identificación rep. legal"
                value={`${identificationTypeLabels[client.legalRepresentative.identificationType]} ${client.legalRepresentative.identificationNumber}`}
              />
              <Field label="Email rep. legal" value={client.legalRepresentative.email} />
              <Field label="Teléfono rep. legal" value={client.legalRepresentative.phone} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
