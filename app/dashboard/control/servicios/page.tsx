import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AlertTriangle } from 'lucide-react'

import { getServicios, getBolsillos } from '@/lib/actions/control.actions'
import { ServiciosTable } from '@/components/dashboard/control/servicios-table'
import { ControlTableSkeleton } from '@/components/dashboard/control/control-skeletons'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export const metadata: Metadata = {
  title: 'Servicios | Control',
  description: 'Servicios referenciados: mensajería y exámenes médicos',
}

async function Listado() {
  const [servicios, bolsillos] = await Promise.all([getServicios(), getBolsillos()])

  if (!servicios.success) {
    return (
      <div className="rounded-md border border-destructive/50 p-6 text-sm text-destructive">
        {servicios.error}
      </div>
    )
  }

  const items = servicios.data ?? []
  const cobradosSinEntregar = items.filter((s) => s.estado === 'COBRADO_SIN_ENTREGAR')

  return (
    <div className="space-y-4">
      {cobradosSinEntregar.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Hay plata de terceros en la caja</AlertTitle>
          <AlertDescription>
            <p>
              {cobradosSinEntregar.length} servicio
              {cobradosSinEntregar.length === 1 ? ' está cobrado' : 's están cobrados'} y
              todavía sin entregar. Con margen cero eso no es ganancia: es plata que
              hay que pasar.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <ServiciosTable servicios={items} bolsillos={bolsillos.data ?? []} />
    </div>
  )
}

export default function ServiciosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Servicios referenciados</h1>
        <p className="text-muted-foreground">
          Admon cobra, entrega a un tercero y a veces deja margen. Cada servicio
          tiene dos patas y no está completo hasta que se registran las dos.
        </p>
      </div>

      <Suspense fallback={<ControlTableSkeleton filas={6} columnas={9} />}>
        <Listado />
      </Suspense>
    </div>
  )
}
