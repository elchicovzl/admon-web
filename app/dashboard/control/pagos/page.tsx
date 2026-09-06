import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AlertTriangle, Info } from 'lucide-react'

import {
  getPagosDelPeriodo,
  getBolsillos,
  getCategorias,
} from '@/lib/actions/control.actions'
import {
  formatearMonto,
  formatearPeriodo,
  periodoActual,
} from '@/lib/utils/control-format'
import { PagosClient } from '@/components/dashboard/control/pagos-client'
import { SelectorPeriodo } from '@/components/dashboard/control/selector-periodo'
import { ControlTableSkeleton } from '@/components/dashboard/control/control-skeletons'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export const metadata: Metadata = {
  title: 'Pagos | Control',
  description: 'Egresos registrados en Alegra',
}

interface PageProps {
  searchParams: Promise<{ periodo?: string }>
}

async function Pagos({ periodo }: { periodo: string }) {
  const [r, bolsillos, categorias] = await Promise.all([
    getPagosDelPeriodo(periodo),
    getBolsillos(),
    getCategorias(),
  ])

  if (!r.success || !r.data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>No se pudo leer Alegra</AlertTitle>
        <AlertDescription>
          <p>{r.error}</p>
        </AlertDescription>
      </Alert>
    )
  }

  const d = r.data

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Se traen los PAGOS, no las facturas de compra</AlertTitle>
        <AlertDescription>
          <p>
            Control es un libro de caja: una factura de compra sin pagar no sacó
            plata de ninguna caja. Alegra advierte que la factura y su pago son
            el mismo gasto en dos momentos y que nunca se suman, así que acá solo
            entra el pago.
          </p>
        </AlertDescription>
      </Alert>

      {d.posiblementeIncompleto && (
        <Alert variant={d.pagos.length === 0 ? 'default' : 'destructive'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>La búsqueda en Alegra quedó corta</AlertTitle>
          <AlertDescription>
            <p>
              /payments no acepta ningún filtro de fecha, así que el mes se
              resuelve recorriendo páginas y esta vez se llegó al tope. Lo que
              ves es un piso, no el total.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-6 text-sm">
        <div>
          <p className="text-muted-foreground">Pagado en el mes</p>
          <p className="text-lg font-bold tabular-nums">
            {formatearMonto(d.totalPagado)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Falta registrar</p>
          <p className="text-lg font-bold tabular-nums">
            {formatearMonto(d.totalPendienteDeRegistrar)}
          </p>
          <p className="text-xs text-muted-foreground">
            {d.cantidadPendiente} pago{d.cantidadPendiente === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <PagosClient
        datos={d}
        bolsillos={bolsillos.data ?? []}
        categorias={categorias.data ?? []}
      />
    </div>
  )
}

export default async function PagosPage({ searchParams }: PageProps) {
  const { periodo: p } = await searchParams
  const periodo = p ?? periodoActual()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pagos</h1>
          <p className="text-muted-foreground">
            Egresos de Alegra · {formatearPeriodo(periodo)}
          </p>
        </div>
        <SelectorPeriodo periodo={periodo} />
      </div>

      <Suspense
        key={periodo}
        fallback={<ControlTableSkeleton filas={10} columnas={6} />}
      >
        <Pagos periodo={periodo} />
      </Suspense>
    </div>
  )
}
