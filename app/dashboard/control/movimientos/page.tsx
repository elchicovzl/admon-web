import { Suspense } from 'react'
import type { Metadata } from 'next'

import {
  getMovimientos,
  getBolsillos,
  getCategorias,
  getContrapartes,
} from '@/lib/actions/control.actions'
import { formatearPeriodo, periodoActual } from '@/lib/utils/control-format'
import { MovimientosTable } from '@/components/dashboard/control/movimientos-table'
import { MovimientoFormDialog } from '@/components/dashboard/control/movimiento-form-dialog'
import { ControlTableSkeleton } from '@/components/dashboard/control/control-skeletons'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = {
  title: 'Movimientos | Control',
  description: 'Movimientos del libro de caja interno',
}

interface PageProps {
  searchParams: Promise<{ periodo?: string }>
}

async function Listado({ periodo }: { periodo: string }) {
  const resultado = await getMovimientos({ periodo })

  if (!resultado.success) {
    return (
      <div className="rounded-md border border-destructive/50 p-6 text-sm text-destructive">
        {resultado.error}
      </div>
    )
  }

  return <MovimientosTable movimientos={resultado.data ?? []} />
}

/**
 * Los catálogos se cargan en paralelo y aparte del listado: el formulario los
 * necesita para poder abrirse, pero no tiene por qué esperar a que se
 * resuelvan los movimientos del periodo.
 */
async function BotonNuevo() {
  const [bolsillos, categorias, contrapartes] = await Promise.all([
    getBolsillos(),
    getCategorias(),
    getContrapartes(),
  ])

  return (
    <MovimientoFormDialog
      bolsillos={bolsillos.data ?? []}
      categorias={categorias.data ?? []}
      contrapartes={contrapartes.data ?? []}
    />
  )
}

export default async function MovimientosPage({ searchParams }: PageProps) {
  const { periodo: periodoParam } = await searchParams
  const periodo = periodoParam ?? periodoActual()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Movimientos</h1>
          <p className="text-muted-foreground">{formatearPeriodo(periodo)}</p>
        </div>
        <Suspense fallback={<Skeleton className="h-9 w-40" />}>
          <BotonNuevo />
        </Suspense>
      </div>

      <Suspense fallback={<ControlTableSkeleton filas={10} columnas={7} />}>
        <Listado periodo={periodo} />
      </Suspense>
    </div>
  )
}
