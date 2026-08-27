import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'

import { getResumenPeriodo, getPrestamos, getServicios } from '@/lib/actions/control.actions'
import {
  formatearMonto,
  formatearDiferencia,
  formatearPeriodo,
  periodoActual,
} from '@/lib/utils/control-format'
import { ControlStatsSkeleton, ControlTableSkeleton } from '@/components/dashboard/control/control-skeletons'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const metadata: Metadata = {
  title: 'Control | Dashboard',
  description: 'Libro de caja interno',
}

interface PageProps {
  searchParams: Promise<{ periodo?: string }>
}

async function Kpis({ periodo }: { periodo: string }) {
  const resultado = await getResumenPeriodo(periodo)

  if (!resultado.success || !resultado.data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>No se pudo calcular el periodo</AlertTitle>
        <AlertDescription>{resultado.error}</AlertDescription>
      </Alert>
    )
  }

  const { totalIngresos, totalEgresos, saldoConsolidado, tieneDescuadres, cierres } =
    resultado.data

  const tarjetas = [
    {
      titulo: 'Ingresos del mes',
      valor: formatearMonto(totalIngresos),
      icono: TrendingUp,
      nota: 'Todo lo que entró, sin traslados',
    },
    {
      titulo: 'Egresos del mes',
      valor: formatearMonto(totalEgresos),
      icono: TrendingDown,
      nota: 'Todo lo que salió, sin traslados',
    },
    {
      titulo: 'Saldo consolidado',
      valor: formatearMonto(saldoConsolidado),
      icono: Wallet,
      nota: 'Suma calculada de todos los bolsillos',
    },
    {
      titulo: 'Bolsillos cerrados',
      valor: `${cierres.filter((c) => c.cerrado).length} / ${cierres.length}`,
      icono: Wallet,
      nota: 'Un periodo cerrado no admite movimientos',
    },
  ]

  return (
    <div className="space-y-4">
      {tieneDescuadres && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Hay descuadres sin justificar</AlertTitle>
          <AlertDescription>
            Uno o más bolsillos tienen una diferencia entre lo contado y lo
            calculado, y nadie explicó a qué se debe. El periodo no se puede
            cerrar así.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((tarjeta) => {
          const Icono = tarjeta.icono
          return (
            <Card key={tarjeta.titulo}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{tarjeta.titulo}</CardTitle>
                <Icono className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">{tarjeta.valor}</div>
                <p className="text-xs text-muted-foreground">{tarjeta.nota}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

async function SaldosPorBolsillo({ periodo }: { periodo: string }) {
  const resultado = await getResumenPeriodo(periodo)
  if (!resultado.success || !resultado.data) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saldo por bolsillo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bolsillo</TableHead>
                <TableHead className="text-right">Inicial</TableHead>
                <TableHead className="text-right">Calculado</TableHead>
                <TableHead className="text-right">Contado</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultado.data.cierres.map((cierre) => (
                <TableRow key={cierre.bolsillo.id}>
                  <TableCell className="font-medium">{cierre.bolsillo.nombre}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatearMonto(cierre.saldoInicial)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatearMonto(cierre.saldoFinalCalculado)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {/* "no se contó" y "contó cero" no son lo mismo. */}
                    {cierre.saldoFinalReal === null
                      ? '—'
                      : formatearMonto(cierre.saldoFinalReal)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {cierre.diferencia === null ? (
                      '—'
                    ) : cierre.diferencia === 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Cuadra
                      </span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        {formatearDiferencia(cierre.diferencia)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {cierre.cerrado ? (
                      <Badge variant="secondary">Cerrado</Badge>
                    ) : (
                      <Badge variant="outline">Abierto</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

async function Pendientes() {
  const [prestamos, servicios] = await Promise.all([getPrestamos(), getServicios()])

  const abiertos = (prestamos.data ?? []).filter(
    (p) => p.estado === 'ABIERTO' || p.estado === 'PARCIAL'
  )
  const totalPrestado = abiertos.reduce((acc, p) => acc + p.saldoActual, 0)

  const incompletos = (servicios.data ?? []).filter((s) => s.estado !== 'COMPLETO')

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Préstamos con saldo</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/control/prestamos">
              Ver todos <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {formatearMonto(totalPrestado)}
          </div>
          <p className="text-xs text-muted-foreground">
            {abiertos.length} préstamo{abiertos.length === 1 ? '' : 's'} sin cancelar
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Servicios a medio camino</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/control/servicios">
              Ver todos <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">{incompletos.length}</div>
          <p className="text-xs text-muted-foreground">
            Cobrados sin entregar, o entregados sin cobrar
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function ControlPage({ searchParams }: PageProps) {
  const { periodo: periodoParam } = await searchParams
  const periodo = periodoParam ?? periodoActual()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Control</h1>
          <p className="text-muted-foreground">
            Libro de caja interno · {formatearPeriodo(periodo)}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/control/movimientos">Registrar movimiento</Link>
        </Button>
      </div>

      <Suspense fallback={<ControlStatsSkeleton />}>
        <Kpis periodo={periodo} />
      </Suspense>

      <Suspense fallback={<ControlTableSkeleton filas={5} columnas={6} />}>
        <SaldosPorBolsillo periodo={periodo} />
      </Suspense>

      <Suspense fallback={<ControlStatsSkeleton tarjetas={2} />}>
        <Pendientes />
      </Suspense>
    </div>
  )
}
