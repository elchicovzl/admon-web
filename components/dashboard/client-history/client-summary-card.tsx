import { ClientType, IdentificationType } from '@prisma/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ClientWithRelations } from '@/lib/types/client.types'
import { formatEmployeeCompanies } from '@/lib/utils/employment'

const identificationTypeLabels: Record<IdentificationType, string> = {
  CEDULA: 'CC',
  TARJETA_IDENTIDAD: 'TI',
  REGISTRO_CIVIL: 'RC',
  CEDULA_EXTRANJERIA: 'CE',
  PASAPORTE: 'PA',
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

function Field({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="truncate text-sm">{value || '—'}</p>
    </div>
  )
}

interface ClientSummaryCardProps {
  client: ClientWithRelations
}

export function ClientSummaryCard({ client }: ClientSummaryCardProps) {
  const ss: { k: string; v: string }[] = []
  if (client.eps) ss.push({ k: 'EPS', v: client.eps.name })
  if (client.afp) ss.push({ k: 'AFP', v: client.afp.name })
  if (client.arl) {
    ss.push({
      k: 'ARL',
      v: `${client.arl.name}${client.arlRiskLevel ? ` · Riesgo ${client.arlRiskLevel}` : ''}`,
    })
  }
  if (client.ccf) ss.push({ k: 'CCF', v: client.ccf.name })

  const addressLine = client.address
    ? [
        client.address.direccion,
        client.address.ciudad,
        client.address.municipio,
        client.address.departamento,
      ]
        .filter(Boolean)
        .join(', ')
    : null

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {/* Identity grid — dense */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          <Field
            label="Identificación"
            value={`${identificationTypeLabels[client.identificationType]} ${client.identificationNumber}`}
          />
          <Field label="Tipo" value={clientTypeLabels[client.clientType]} />
          <Field label="Email" value={client.email} />
          <Field label="Teléfono" value={client.phone} />
          {addressLine && (
            <Field label="Dirección" value={addressLine} className="col-span-2" />
          )}
          {formatEmployeeCompanies(client.employmentsAsEmployee) && (
            <Field label="Empresa" value={formatEmployeeCompanies(client.employmentsAsEmployee)} />
          )}
          {client.legalRepresentative && (
            <Field label="Rep. legal" value={client.legalRepresentative.fullName} />
          )}
        </div>

        {/* Seguridad social — compact inline badges */}
        {ss.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Seguridad social
            </span>
            {ss.map((a) => (
              <Badge key={a.k} variant="outline" className="font-normal">
                <span className="font-semibold">{a.k}</span>&nbsp;{a.v}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
