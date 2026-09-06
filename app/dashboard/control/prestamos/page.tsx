import { Suspense } from 'react'
import type { Metadata } from 'next'

import {
  getPrestamos,
  getBolsillos,
  getContrapartes,
} from '@/lib/actions/control.actions'
import { formatearMonto } from '@/lib/utils/control-format'
import { PrestamosTable } from '@/components/dashboard/control/prestamos-table'
import { PrestamoFormDialog } from '@/components/dashboard/control/prestamo-form-dialog'
import { ControlTableSkeleton } from '@/components/dashboard/control/control-skeletons'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = {
  title: 'Préstamos | Control',
  description: 'Préstamos y anticipos del libro de caja interno',
}

/** El botón vive aparte para que no espere a que carguen los préstamos. */
async function BotonNuevo() {
  const [bolsillos, contrapartes] = await Promise.all([getBolsillos(), getContrapartes()])

  return (
    <PrestamoFormDialog
      bolsillos={bolsillos.data ?? []}
      contrapartes={contrapartes.data ?? []}
    />
  )
}

async function Listado() {
  const [prestamos, bolsillos] = await Promise.all([getPrestamos(), getBolsillos()])

  if (!prestamos.success) {
    return (
      <div className="rounded-md border border-destructive/50 p-6 text-sm text-destructive">
        {prestamos.error}
      </div>
    )
  }

  const items = prestamos.data ?? []
  const vivos = items.filter((p) => p.estado === 'ABIERTO' || p.estado === 'PARCIAL')
  const totalVivo = vivos.reduce((acc, p) => acc + p.saldoActual, 0)

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {vivos.length} préstamo{vivos.length === 1 ? '' : 's'} sin cancelar por{' '}
        <span className="font-medium text-foreground tabular-nums">
          {formatearMonto(totalVivo)}
        </span>
      </p>
      <PrestamosTable prestamos={items} bolsillos={bolsillos.data ?? []} />
    </div>
  )
}

export default function PrestamosPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Préstamos</h1>
          <p className="text-muted-foreground">
            El saldo y el estado se calculan desde los movimientos — no se digitan.
          </p>
        </div>
        <Suspense fallback={<Skeleton className="h-9 w-44" />}>
          <BotonNuevo />
        </Suspense>
      </div>

      <Suspense fallback={<ControlTableSkeleton filas={8} columnas={8} />}>
        <Listado />
      </Suspense>
    </div>
  )
}
