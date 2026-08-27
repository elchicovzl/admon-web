import { Suspense } from 'react'
import type { Metadata } from 'next'

import { getResumenPeriodo } from '@/lib/actions/control.actions'
import { formatearPeriodo, periodoActual } from '@/lib/utils/control-format'
import { CierresTable } from '@/components/dashboard/control/cierres-table'
import { ControlTableSkeleton } from '@/components/dashboard/control/control-skeletons'

export const metadata: Metadata = {
  title: 'Cierre mensual | Control',
  description: 'Cierre mensual del libro de caja interno',
}

interface PageProps {
  searchParams: Promise<{ periodo?: string }>
}

async function Cierres({ periodo }: { periodo: string }) {
  const resultado = await getResumenPeriodo(periodo)

  if (!resultado.success || !resultado.data) {
    return (
      <div className="rounded-md border border-destructive/50 p-6 text-sm text-destructive">
        {resultado.error}
      </div>
    )
  }

  return <CierresTable periodo={periodo} cierres={resultado.data.cierres} />
}

export default async function CierresPage({ searchParams }: PageProps) {
  const { periodo: periodoParam } = await searchParams
  const periodo = periodoParam ?? periodoActual()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cierre mensual</h1>
        <p className="text-muted-foreground">
          {formatearPeriodo(periodo)} · el saldo calculado nunca se digita, sale
          de los movimientos
        </p>
      </div>

      <Suspense fallback={<ControlTableSkeleton filas={6} columnas={8} />}>
        <Cierres periodo={periodo} />
      </Suspense>
    </div>
  )
}
