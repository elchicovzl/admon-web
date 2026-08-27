import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Hash } from 'lucide-react'

import { getReporteAnual } from '@/lib/actions/control.actions'
import { formatearMonto, formatearPeriodo } from '@/lib/utils/control-format'
import { ETIQUETA_GRUPO } from '@/components/dashboard/control/etiquetas'
import { ControlStatsSkeleton, ControlTableSkeleton } from '@/components/dashboard/control/control-skeletons'
import type { FilaAgrupada } from '@/lib/types/control.types'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { GrupoCategoria } from '@prisma/client'

export const metadata: Metadata = {
  title: 'Reportes | Control',
  description: 'Vista anual del libro de caja interno',
}

interface PageProps {
  searchParams: Promise<{ anio?: string }>
}

/** Tabla de un corte del año: categorías, contrapartes o bolsillos. */
function TablaAgrupada({
  filas,
  encabezado,
  mostrarGrupo = false,
}: {
  filas: FilaAgrupada[]
  encabezado: string
  mostrarGrupo?: boolean
}) {
  if (filas.length === 0) {
    return (
      <div className="rounded-md border p-12 text-center text-muted-foreground">
        No hay movimientos en este año.
      </div>
    )
  }

  const mayor = Math.max(...filas.map((f) => f.ingresos + f.egresos), 1)

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{encabezado}</TableHead>
            {mostrarGrupo && <TableHead>Grupo</TableHead>}
            <TableHead className="text-right">Movs</TableHead>
            <TableHead className="text-right">Entró</TableHead>
            <TableHead className="text-right">Salió</TableHead>
            <TableHead className="w-[140px]">Peso</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((f) => {
            const total = f.ingresos + f.egresos
            return (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.nombre}</TableCell>
                {mostrarGrupo && (
                  <TableCell>
                    {f.detalle && (
                      <Badge variant="outline" className="text-xs">
                        {ETIQUETA_GRUPO[f.detalle as GrupoCategoria] ?? f.detalle}
                      </Badge>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {f.cantidad}
                </TableCell>
                <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                  {f.ingresos === 0 ? '—' : formatearMonto(f.ingresos)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">
                  {f.egresos === 0 ? '—' : formatearMonto(f.egresos)}
                </TableCell>
                <TableCell>
                  {/* Barra proporcional: con 26 categorías, una tabla de puros
                      números obliga a comparar de memoria. */}
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.max(2, (total / mayor) * 100)}%` }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

async function Reporte({ anio }: { anio: number }) {
  const resultado = await getReporteAnual(anio)

  if (!resultado.success || !resultado.data) {
    return (
      <div className="rounded-md border border-destructive/50 p-6 text-sm text-destructive">
        {resultado.error}
      </div>
    )
  }

  const r = resultado.data

  return (
    <div className="space-y-6">
      {r.aniosConDatos.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {r.aniosConDatos.map((a) => (
            <Button
              key={a}
              variant={a === anio ? 'default' : 'outline'}
              size="sm"
              asChild
            >
              <Link href={`/dashboard/control/reportes?anio=${a}`}>{a}</Link>
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            titulo: 'Entró en el año',
            valor: formatearMonto(r.totalIngresos),
            icono: TrendingUp,
          },
          {
            titulo: 'Salió en el año',
            valor: formatearMonto(r.totalEgresos),
            icono: TrendingDown,
          },
          {
            titulo: 'Movimientos',
            valor: String(r.cantidadMovimientos),
            icono: Hash,
          },
        ].map((t) => {
          const Icono = t.icono
          return (
            <Card key={t.titulo}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t.titulo}</CardTitle>
                <Icono className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">{t.valor}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mes a mes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">Movs</TableHead>
                  <TableHead className="text-right">Entró</TableHead>
                  <TableHead className="text-right">Salió</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.meses.map((m) => (
                  <TableRow key={m.periodo}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/control?periodo=${m.periodo}`}
                        className="hover:underline"
                      >
                        {formatearPeriodo(m.periodo)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {m.cantidad}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {m.ingresos === 0 ? '—' : formatearMonto(m.ingresos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">
                      {m.egresos === 0 ? '—' : formatearMonto(m.egresos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatearMonto(m.neto)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="categorias">
        <TabsList>
          <TabsTrigger value="categorias">Por categoría</TabsTrigger>
          <TabsTrigger value="contrapartes">Por contraparte</TabsTrigger>
          <TabsTrigger value="bolsillos">Por bolsillo</TabsTrigger>
        </TabsList>

        <TabsContent value="categorias" className="space-y-2">
          <p className="text-sm text-muted-foreground">
            En qué se fue la plata. Esta es la pregunta que el Excel no podía
            responder, porque el tipo de gasto y el nombre de la persona vivían
            en la misma columna.
          </p>
          <TablaAgrupada filas={r.porCategoria} encabezado="Categoría" mostrarGrupo />
        </TabsContent>

        <TabsContent value="contrapartes" className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Cuánto se le pagó a cada quien en el año, o cuánto pagó cada quien.
          </p>
          <TablaAgrupada filas={r.porContraparte} encabezado="Contraparte" />
        </TabsContent>

        <TabsContent value="bolsillos" className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Por qué caja pasó el movimiento. Los traslados no se cuentan como
            ingreso ni egreso: mover plata entre bolsillos no es ninguna de las
            dos cosas.
          </p>
          <TablaAgrupada filas={r.porBolsillo} encabezado="Bolsillo" />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default async function ReportesPage({ searchParams }: PageProps) {
  const { anio: anioParam } = await searchParams
  const anio = Number(anioParam) || new Date().getUTCFullYear()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground">Vista anual del libro · {anio}</p>
      </div>

      <Suspense
        fallback={
          <div className="space-y-6">
            <ControlStatsSkeleton tarjetas={3} />
            <ControlTableSkeleton filas={8} columnas={5} />
          </div>
        }
      >
        <Reporte anio={anio} />
      </Suspense>
    </div>
  )
}
