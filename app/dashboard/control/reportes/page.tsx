import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Hash, ArrowLeftRight } from 'lucide-react'

import { getReporteAnual } from '@/lib/actions/control.actions'
import { formatearMonto, formatearPeriodo } from '@/lib/utils/control-format'
import { ETIQUETA_GRUPO } from '@/components/dashboard/control/etiquetas'
import { Monto } from '@/components/dashboard/control/monto'
import { ControlStatsSkeleton, ControlTableSkeleton } from '@/components/dashboard/control/control-skeletons'
import type { FilaAgrupada, ContrasteIntermediado } from '@/lib/types/control.types'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import type { GrupoCategoria } from '@prisma/client'

export const metadata: Metadata = {
  title: 'Reportes | Control',
  description: 'Vista anual del libro de caja interno',
}

interface PageProps {
  searchParams: Promise<{ anio?: string }>
}

/**
 * Lo que entró contra lo que salió, para un servicio en tránsito.
 *
 * Es la única vista del libro que puede DESMENTIR un "entra y vuelve a salir".
 * Por eso el margen no se maquilla: si da negativo todos los meses, se ve.
 */
function ContrasteDeServicio({ c }: { c: ContrasteIntermediado }) {
  const noCierra = c.totalMargen !== 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{c.servicio}</CardTitle>
        <CardDescription>
          {c.categoriaEgreso
            ? `Sale por la categoría "${c.categoriaEgreso}".`
            : 'No tiene categoría de egreso configurada: a esta plata no se le registró la salida, así que está inflando el saldo de los bolsillos.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {noCierra && (
          <Alert variant={c.totalMargen < 0 ? 'destructive' : 'default'}>
            <AlertTitle>
              {c.totalMargen < 0
                ? 'Salió más de lo que entró'
                : 'Entró más de lo que salió'}
            </AlertTitle>
            <AlertDescription>
              <p>
                Entraron {formatearMonto(c.totalEntro)} y salieron{' '}
                {formatearMonto(c.totalSalio)}: una diferencia de{' '}
                <strong>{formatearMonto(Math.abs(c.totalMargen))}</strong>. Si esta
                plata solo pasa, el contraste debería dar cerca de cero.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">Entró</TableHead>
                <TableHead className="text-right">Salió</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.meses.map((m) => (
                <TableRow key={m.periodo}>
                  <TableCell className="font-medium">
                    {formatearPeriodo(m.periodo)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {m.entro === 0 ? '—' : formatearMonto(m.entro)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">
                    {m.salio === 0 ? '—' : formatearMonto(m.salio)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Monto valor={m.margen} />
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-medium">
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatearMonto(c.totalEntro)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">
                  {formatearMonto(c.totalSalio)}
                </TableCell>
                <TableCell className="text-right">
                  <Monto valor={c.totalMargen} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
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

  // Los ingresos que no son ni cotización ni factura solo se muestran cuando
  // existen: en un año que no los tiene, una columna de guiones es ruido.
  const hayOtrosIngresos = r.ingresos.otros.bruto > 0

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            titulo: 'Entró por cotización (C)',
            valor: formatearMonto(r.ingresos.cotizacion.bruto),
            icono: TrendingUp,
          },
          {
            titulo: 'Entró por factura (F)',
            valor: formatearMonto(r.ingresos.factura.bruto),
            icono: TrendingUp,
          },
          // Sin esta tarjeta, C + F no da el total de ingresos y la fila deja
          // de cuadrar apenas entra un abono a préstamo o una devolución. Se
          // muestra solo cuando hay algo: en un año sin otros ingresos, un
          // cero no explica nada.
          ...(hayOtrosIngresos
            ? [
                {
                  titulo: 'Otros ingresos',
                  valor: formatearMonto(r.ingresos.otros.bruto),
                  icono: TrendingUp,
                  detalle: r.ingresos.otros.porCategoria,
                },
              ]
            : []),
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
                {/* De qué se compone. Un agregado que junta abonos,
                    devoluciones y cargas manuales no se puede cuadrar contra
                    nada; con el desglose al lado, sí. */}
                {'detalle' in t && t.detalle && t.detalle.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {t.detalle.map((c) => (
                      <li key={c.nombre} className="flex justify-between gap-2">
                        <span className="truncate">{c.nombre}</span>
                        <span className="tabular-nums">{formatearMonto(c.monto)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Lo ganado, separado de lo que solo pasó.
          Solo se muestra si hay algo en tránsito: con el catálogo recién
          sincronizado y sin cobros importados, esta tarjeta sería un cero que
          no explica nada. */}
      {r.ingresoNeto.enTransito > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ingreso real del año
            </CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold tabular-nums">
              {formatearMonto(r.ingresoNeto.netos)}
            </div>
            <p className="text-sm text-muted-foreground">
              De los {formatearMonto(r.totalIngresos)} que entraron,{' '}
              <strong>{formatearMonto(r.ingresoNeto.enTransito)}</strong> son plata
              en tránsito — entra y vuelve a salir, como el recaudo para
              terceros. El saldo de los bolsillos NO cambia: esa plata sí pasó
              por la caja.
            </p>
          </CardContent>
        </Card>
      )}

      {/* La cobertura va al lado del número, siempre. El desglose por servicio
          existe solo desde que se importa con él: sin decir cuánto quedó
          afuera, el neto parecería exacto. */}
      {r.ingresoNeto.sinDesglose > 0 && r.totalIngresos > 0 && (
        <Alert>
          <AlertTitle>El corte por servicio no cubre todo el año</AlertTitle>
          <AlertDescription>
            <p>
              {formatearMonto(r.ingresoNeto.sinDesglose)} de{' '}
              {formatearMonto(r.totalIngresos)} entraron sin desglose por servicio
              {r.ingresoNeto.conDesglose === 0
                ? '. Todavía no se importó ningún cobro con detalle.'
                : `, así que "ingreso real" descontó solo lo que pudo mirar.`}
            </p>
          </AlertDescription>
        </Alert>
      )}

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
                  <TableHead className="text-right">Entró C</TableHead>
                  <TableHead className="text-right">Entró F</TableHead>
                  {/* Solo si el año tiene ingresos que no son ni C ni F. Sin
                      esta columna la fila no sumaría a la vista. */}
                  {hayOtrosIngresos && (
                    <TableHead className="text-right">Otros</TableHead>
                  )}
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
                    {/* En bruto: esta tabla es un flujo de caja y su columna
                        Neto significa ingresos − egresos. Descontar el tránsito
                        acá cambiaría en silencio lo que significa la otra
                        columna. El ingreso real vive en su propia tarjeta. */}
                    <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {m.ingresosCotizacion === 0
                        ? '—'
                        : formatearMonto(m.ingresosCotizacion)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {m.ingresosFactura === 0 ? '—' : formatearMonto(m.ingresosFactura)}
                    </TableCell>
                    {hayOtrosIngresos && (
                      <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                        {m.ingresosOtros === 0 ? '—' : formatearMonto(m.ingresosOtros)}
                      </TableCell>
                    )}
                    <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">
                      {m.egresos === 0 ? '—' : formatearMonto(m.egresos)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <Monto valor={m.neto} />
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totales. Es lo que permite verificar de un vistazo que
                    C + F + Otros da lo que entró en el año: una tabla que no
                    suma a la vista no se puede cuadrar contra nada. */}
                <TableRow className="border-t-2 font-medium">
                  <TableCell>Total {r.anio}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.cantidadMovimientos}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {r.ingresos.cotizacion.bruto === 0
                      ? '—'
                      : formatearMonto(r.ingresos.cotizacion.bruto)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {r.ingresos.factura.bruto === 0
                      ? '—'
                      : formatearMonto(r.ingresos.factura.bruto)}
                  </TableCell>
                  {hayOtrosIngresos && (
                    <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatearMonto(r.ingresos.otros.bruto)}
                    </TableCell>
                  )}
                  <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">
                    {r.totalEgresos === 0 ? '—' : formatearMonto(r.totalEgresos)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Monto valor={r.totalIngresos - r.totalEgresos} />
                  </TableCell>
                </TableRow>
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
          <TabsTrigger value="servicios">Por servicio</TabsTrigger>
          <TabsTrigger value="intermediados">Entra y sale</TabsTrigger>
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

        <TabsContent value="servicios" className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Por qué entró la plata. Es el desglose de cada cobro en los
            servicios que lo componen: una factura de 729.000 puede ser 150.000
            de administración y 579.000 de recaudo para terceros. Los marcados{' '}
            <strong>En tránsito</strong> no son ingreso de Admon.
          </p>
          {r.porServicio.length === 0 ? (
            <div className="rounded-md border p-12 text-center text-muted-foreground">
              Todavía no hay cobros con desglose por servicio. Importalos desde
              Cobros, o cargá un ingreso manual eligiendo el servicio.
            </div>
          ) : (
            <TablaAgrupada filas={r.porServicio} encabezado="Servicio" mostrarGrupo />
          )}
        </TabsContent>

        <TabsContent value="intermediados" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Los servicios marcados <strong>en tránsito</strong>: su plata entra y
            vuelve a salir, así que no es ingreso de Admon. Acá se contrasta un
            lado contra el otro. Si la diferencia no da cerca de cero, algo no
            está registrado — y eso es información, no un error de la app.
          </p>

          {r.intermediados.length === 0 ? (
            <div className="rounded-md border p-12 text-center text-muted-foreground">
              Ningún servicio está marcado como plata en tránsito. Se marcan en
              Catálogos → Servicios Alegra.
            </div>
          ) : (
            r.intermediados.map((c) => (
              <ContrasteDeServicio key={c.servicioId} c={c} />
            ))
          )}
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
