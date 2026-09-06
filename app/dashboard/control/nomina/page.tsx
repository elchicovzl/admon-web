import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Info, ArrowUpCircle, ArrowDownCircle, Users } from 'lucide-react'

import { getNominaDelAnio } from '@/lib/actions/control.actions'
import { formatearMonto, formatearPeriodo } from '@/lib/utils/control-format'
import { ControlTableSkeleton } from '@/components/dashboard/control/control-skeletons'
import type { FilaDeNomina } from '@/lib/utils/control-ledger'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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

export const metadata: Metadata = {
  title: 'Nómina | Control',
  description: 'Lo que se le paga al equipo, por arriba y por debajo',
}

interface PageProps {
  searchParams: Promise<{ anio?: string }>
}

/** Filas de personas o de categorías: las dos tienen la misma forma. */
function TablaNomina({
  filas,
  encabezado,
}: {
  filas: FilaDeNomina[]
  encabezado: string
}) {
  if (filas.length === 0) {
    return (
      <div className="rounded-md border p-12 text-center text-muted-foreground">
        No hay nómina registrada en este año.
      </div>
    )
  }

  const mayor = Math.max(...filas.map((f) => f.total), 1)

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{encabezado}</TableHead>
            <TableHead className="text-right">Movs</TableHead>
            <TableHead className="text-right">Por arriba</TableHead>
            <TableHead className="text-right">Por debajo</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="w-[120px]">Peso</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((f) => (
            <TableRow key={f.persona}>
              <TableCell className="font-medium">{f.persona}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {f.movs}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {f.porArriba === 0 ? '—' : formatearMonto(f.porArriba)}
              </TableCell>
              {/* Lo "por debajo" se destaca: es la parte que no deja rastro en
                  ningún otro sistema, y por eso este módulo existe. */}
              <TableCell className="text-right font-medium tabular-nums text-amber-600 dark:text-amber-400">
                {f.porDebajo === 0 ? '—' : formatearMonto(f.porDebajo)}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatearMonto(f.total)}
              </TableCell>
              <TableCell>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.round((f.total / mayor) * 100)}%` }}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

async function Nomina({ anio }: { anio: number }) {
  const resultado = await getNominaDelAnio(anio)

  if (!resultado.success || !resultado.data) {
    return (
      <div className="rounded-md border border-destructive/50 p-6 text-sm text-destructive">
        {resultado.error}
      </div>
    )
  }

  const n = resultado.data

  /**
   * Personas que aparecen SOLO de un lado.
   *
   * Es la señal de que dos filas pueden ser la misma persona escrita distinto
   * —"ANDREA" y "ANDREA BEDOYA"—, y también de quién cobra únicamente por
   * debajo. Las dos cosas se leen igual acá y hay que mirarlas.
   */
  const soloUnLado = n.personas.filter((p) => p.porArriba === 0 || p.porDebajo === 0)

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Esto no sale de un módulo de nómina de Alegra</AlertTitle>
        <AlertDescription>
          <p>
            Alegra no expone nómina en su API: no hay empleados, contratos ni
            desprendibles. Así que esta vista se arma desde los egresos ya
            registrados, y por eso puede hacer algo que el módulo de Alegra no
            haría — juntar lo que se paga por Alegra con lo que se paga por
            debajo. Qué categorías cuentan como nómina se decide en{' '}
            <Link href="/dashboard/control/catalogos" className="underline">
              Catálogos
            </Link>
            .
          </p>
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            titulo: 'Por arriba (Alegra)',
            valor: formatearMonto(n.totalPorArriba),
            icono: ArrowUpCircle,
            nota: 'El pago está registrado en Alegra',
          },
          {
            titulo: 'Por debajo',
            valor: formatearMonto(n.totalPorDebajo),
            icono: ArrowDownCircle,
            nota: 'No está en Alegra: del Excel o cargado a mano',
          },
          {
            titulo: 'Nómina del año',
            valor: formatearMonto(n.total),
            icono: Users,
            nota: `${n.personas.length} personas o proveedores`,
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
                <p className="text-xs text-muted-foreground">{t.nota}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {soloUnLado.length > 0 && (
        <Alert>
          <AlertTitle>Los nombres no se emparejan solos</AlertTitle>
          <AlertDescription>
            <p>
              {soloUnLado.length} de {n.personas.length} filas aparecen de un solo
              lado. Algunas serán personas que cobran únicamente por una vía, pero
              otras pueden ser la misma persona escrita distinto en cada fuente
              —&quot;ANDREA&quot; y &quot;ANDREA BEDOYA&quot;—. No se fusionan por
              parecido a propósito: existiendo también &quot;DANIELA ARANGO
              BEDOYA&quot;, adivinar mezclaría el sueldo de dos personas. Para
              unirlas, asignales la misma contraparte.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Mes a mes</CardTitle>
          <CardDescription>
            Cuánto costó el equipo cada mes, y por qué vía se pagó.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">Por arriba</TableHead>
                  <TableHead className="text-right">Por debajo</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {n.meses.map((m) => (
                  <TableRow key={m.periodo}>
                    <TableCell className="font-medium">
                      {formatearPeriodo(m.periodo)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.porArriba === 0 ? '—' : formatearMonto(m.porArriba)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-amber-600 dark:text-amber-400">
                      {m.porDebajo === 0 ? '—' : formatearMonto(m.porDebajo)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatearMonto(m.total)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-medium">
                  <TableCell>Total {anio}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearMonto(n.totalPorArriba)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-amber-600 dark:text-amber-400">
                    {formatearMonto(n.totalPorDebajo)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearMonto(n.total)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="personas">
        <TabsList>
          <TabsTrigger value="personas">Por persona</TabsTrigger>
          <TabsTrigger value="conceptos">Por concepto</TabsTrigger>
        </TabsList>

        <TabsContent value="personas" className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Quién cobró y por qué vía. Ojo: los aportes a seguridad social se le
            pagan al operador, no a la persona, así que aparecen como una fila
            propia.
          </p>
          <TablaNomina filas={n.personas} encabezado="Persona o proveedor" />
        </TabsContent>

        <TabsContent value="conceptos" className="space-y-2">
          <p className="text-sm text-muted-foreground">
            En qué se va el costo del equipo: sueldos, honorarios, aportes,
            cesantías, dotación.
          </p>
          <TablaNomina filas={n.categorias} encabezado="Concepto" />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default async function NominaPage({ searchParams }: PageProps) {
  const { anio: anioParam } = await searchParams
  const anio = Number(anioParam) || new Date().getUTCFullYear()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nómina</h1>
          <p className="text-muted-foreground">
            Lo que cuesta el equipo · {anio}
          </p>
        </div>
        <div className="flex gap-1">
          {[anio - 1, anio, anio + 1].map((a) => (
            <Button
              key={a}
              variant={a === anio ? 'default' : 'outline'}
              size="sm"
              asChild
            >
              <Link href={`/dashboard/control/nomina?anio=${a}`}>{a}</Link>
            </Button>
          ))}
        </div>
      </div>

      <Suspense key={anio} fallback={<ControlTableSkeleton filas={10} columnas={6} />}>
        <Nomina anio={anio} />
      </Suspense>
    </div>
  )
}
