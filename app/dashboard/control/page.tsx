import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import {
  TrendingUp,
  TrendingDown,
  Users,
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
import { cn } from '@/lib/utils'
import { Monto } from '@/components/dashboard/control/monto'
import type { FilaDesglose } from '@/lib/types/control.types'
import { ControlStatsSkeleton, ControlTableSkeleton } from '@/components/dashboard/control/control-skeletons'
import { SelectorPeriodo } from '@/components/dashboard/control/selector-periodo'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

  const {
    saldoConsolidado,
    tieneDescuadres,
    cierres,
    ingresos,
    egresoReal,
  } = resultado.data

  /**
   * Lo que entró de verdad: los cobros netos de plata en tránsito, más lo que
   * no viene ni de una cotización ni de una factura.
   */
  const ingresoReal =
    ingresos.cotizacion.neto + ingresos.factura.neto + ingresos.otros.neto

  const tarjetas = [
    // C y F van en tarjetas separadas porque para el negocio son cosas
    // distintas — "por debajo" y "por arriba" — y sumarlas en un solo número
    // pierde media razón de ser del módulo.
    {
      titulo: 'Ingresos por cotización (C)',
      valor: formatearMonto(ingresos.cotizacion.neto),
      icono: TrendingUp,
      // Las cotizaciones no llevan IVA ni plata en tránsito, así que el neto
      // y el bruto coinciden. Se usa el neto igual, para que la tarjeta no
      // mienta el día que aparezca un caso distinto.
      nota: '"Por debajo". El documento es una cotización de Alegra, sin IVA',
    },
    // Cuando hay plata en tránsito, esta tarjeta muestra lo GANADO y no lo que
    // entró: de una factura de 729.000 solo 150.000 son de Admon, y mostrar
    // los 729.000 hace tomar decisiones sobre plata ajena. El bruto no se
    // esconde: queda en la nota.
    ingresos.factura.enTransito > 0 || ingresos.factura.impuesto > 0
      ? {
          titulo: 'Ingreso real por factura (F)',
          valor: formatearMonto(ingresos.factura.neto),
          icono: TrendingUp,
          // Se nombran las dos cosas que no son ingreso: la plata que solo
          // pasa y el IVA, que se cobra para girarlo a la DIAN.
          nota: `Entraron ${formatearMonto(ingresos.factura.bruto)}; ${[
            ingresos.factura.enTransito > 0
              ? `${formatearMonto(ingresos.factura.enTransito)} en tránsito`
              : null,
            ingresos.factura.impuesto > 0
              ? `${formatearMonto(ingresos.factura.impuesto)} de IVA`
              : null,
          ]
            .filter(Boolean)
            .join(' y ')}`,
        }
      : {
          titulo: 'Ingresos por factura (F)',
          valor: formatearMonto(ingresos.factura.bruto),
          icono: TrendingUp,
          nota: '"Por arriba". El documento es una factura de venta',
        },
    // Solo si hay algo: un abono a préstamo o una devolución también son
    // ingresos, y sin esta tarjeta C + F no daría el total de la fila.
    //
    // La nota dice de QUÉ se compone, no qué podría contener. Un agregado que
    // junta abonos, devoluciones y cargas manuales no se puede cuadrar contra
    // nada; con las categorías al lado, sí.
    ...(ingresos.otros.bruto > 0
      ? [
          {
            titulo: 'Otros ingresos',
            valor: formatearMonto(ingresos.otros.bruto),
            icono: TrendingUp,
            nota: ingresos.otros.porCategoria
              .map((c) => `${c.nombre} ${formatearMonto(c.monto)}`)
              .join(' · '),
          },
        ]
      : []),
    // Lo GASTADO, no lo que salió. De los 84.432.347 que salieron en julio de
    // 2026, 63.875.000 habían entrado para volver a salir; creer que se gastan
    // 84 millones al mes en vez de 20 no es un detalle de presentación.
    egresoReal.enTransito > 0
      ? {
          titulo: 'Egresos reales del mes',
          valor: formatearMonto(egresoReal.neto),
          icono: TrendingDown,
          nota: `Salieron ${formatearMonto(egresoReal.bruto)}; ${formatearMonto(
            egresoReal.enTransito
          )} entró y volvió a salir`,
        }
      : {
          titulo: 'Egresos del mes',
          valor: formatearMonto(egresoReal.bruto),
          icono: TrendingDown,
          nota: 'Todo lo que salió, sin traslados',
        },
    // El equipo es el gasto más grande de esta empresa y merece su propia
    // tarjeta, no quedar escondido dentro del total.
    {
      titulo: 'Nómina del mes',
      valor: formatearMonto(egresoReal.nomina),
      icono: Users,
      nota:
        egresoReal.neto > 0
          ? `${Math.round((egresoReal.nomina / egresoReal.neto) * 100)}% de lo que gastó la empresa`
          : 'Por arriba y por debajo',
    },
    // El número que resume el mes: lo que entró de verdad contra lo que se
    // gastó de verdad, las dos puntas ya sin la plata que solo pasa.
    {
      titulo: 'Resultado del mes',
      valor: formatearMonto(ingresoReal - egresoReal.neto),
      negativo: ingresoReal - egresoReal.neto < 0,
      icono: Wallet,
      nota: `Entró ${formatearMonto(ingresoReal)} · gastó ${formatearMonto(egresoReal.neto)}`,
    },
    {
      titulo: 'Saldo consolidado',
      valor: formatearMonto(saldoConsolidado),
      // Un consolidado negativo es la señal más importante de la pantalla.
      negativo: saldoConsolidado < 0,
      icono: Wallet,
      // NO es del mes: es lo que hay al cerrar el mes, arrastrando todo lo
      // anterior. Las otras tres tarjetas de la fila SÍ son del mes, y un
      // acumulado sin avisar al lado de tres mensuales se lee como mensual.
      nota: `Acumulado hasta el final de ${formatearPeriodo(periodo)}, no del mes`,
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
            <p>
              Uno o más bolsillos tienen una diferencia entre lo contado y lo
              calculado, y nadie explicó a qué se debe. El periodo no se puede
              cerrar así.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tarjetas.map((tarjeta) => {
          const Icono = tarjeta.icono
          return (
            <Card key={tarjeta.titulo}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{tarjeta.titulo}</CardTitle>
                <Icono className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    'text-2xl font-bold tabular-nums',
                    tarjeta.negativo && 'text-red-600 dark:text-red-400'
                  )}
                >
                  {tarjeta.valor}
                </div>
                <p className="text-xs text-muted-foreground">{tarjeta.nota}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Una de las cuatro listas del desglose.
 *
 * Muestra el total arriba para que se pueda contrastar de un vistazo con la
 * tarjeta de la que cuelga: si no coinciden, hay algo mal y se ve.
 */
function ListaDesglose({
  titulo,
  descripcion,
  filas,
  vacio,
}: {
  titulo: string
  descripcion: string
  filas: FilaDesglose[]
  vacio: string
}) {
  const total = filas.reduce((a, f) => a + f.monto, 0)
  const mayor = Math.max(...filas.map((f) => f.monto), 1)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <CardTitle className="text-sm font-medium">{titulo}</CardTitle>
          <span className="text-sm font-bold tabular-nums">
            {formatearMonto(total)}
          </span>
        </div>
        <CardDescription className="text-xs">{descripcion}</CardDescription>
      </CardHeader>
      <CardContent>
        {filas.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{vacio}</p>
        ) : (
          <ul className="space-y-2">
            {filas.map((f) => (
              <li key={f.nombre} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate" title={f.nombre}>
                    {f.nombre}
                  </span>
                  <span className="shrink-0 tabular-nums">{formatearMonto(f.monto)}</span>
                </div>
                {/* La barra es para comparar de un vistazo, no para leer el
                    valor: el número ya está al lado. */}
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-primary"
                    style={{ width: `${Math.round((f.monto / mayor) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

async function DesgloseDelPeriodo({ periodo }: { periodo: string }) {
  const resultado = await getResumenPeriodo(periodo)
  if (!resultado.success || !resultado.data) return null

  const d = resultado.data.desglose

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <ListaDesglose
        titulo="Ingresos por cotización (C)"
        descripcion="Por qué servicio entró"
        filas={d.cotizacion}
        vacio="No se registraron cobros por cotización."
      />
      <ListaDesglose
        titulo="Ingreso real por factura (F)"
        descripcion="Por servicio, ya sin la plata en tránsito"
        filas={d.factura}
        vacio="No se registraron cobros por factura."
      />
      <ListaDesglose
        titulo="Egresos reales"
        descripcion="En qué se gastó, sin lo que solo pasó"
        filas={d.egresos}
        vacio="No se registraron egresos."
      />
      <ListaDesglose
        titulo="Nómina"
        descripcion="Cuánto cobró cada quien, por arriba y por debajo"
        filas={d.nomina}
        vacio="No se registró nómina en el mes."
      />
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
        <CardDescription>
          Saldos ACUMULADOS, no del mes. &quot;Inicial&quot; es lo que había al
          empezar {formatearPeriodo(periodo)} arrastrando todo lo anterior;
          &quot;Calculado&quot; es eso más los movimientos del mes.
          &quot;Contado&quot; se llena al cerrar el periodo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bolsillo</TableHead>
                <TableHead className="text-right">
                  Inicial
                  <span className="block text-xs font-normal text-muted-foreground">
                    al empezar el mes
                  </span>
                </TableHead>
                <TableHead className="text-right">
                  Calculado
                  <span className="block text-xs font-normal text-muted-foreground">
                    al cerrar el mes
                  </span>
                </TableHead>
                <TableHead className="text-right">Contado</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultado.data.cierres.map((cierre) => (
                <TableRow key={cierre.bolsillo.id}>
                  <TableCell className="font-medium">{cierre.bolsillo.nombre}</TableCell>
                  <TableCell className="text-right">
                    <Monto valor={cierre.saldoInicial} tenue />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <Monto valor={cierre.saldoFinalCalculado} />
                  </TableCell>
                  <TableCell className="text-right">
                    {/* "no se contó" y "contó cero" no son lo mismo. */}
                    {cierre.saldoFinalReal === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Monto valor={cierre.saldoFinalReal} tenue />
                    )}
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
        <div className="flex flex-wrap items-center gap-2">
          <SelectorPeriodo periodo={periodo} />
          <Button asChild>
            <Link href="/dashboard/control/movimientos">Registrar movimiento</Link>
          </Button>
        </div>
      </div>

      <Suspense fallback={<ControlStatsSkeleton />}>
        <Kpis periodo={periodo} />
      </Suspense>

      <Suspense fallback={<ControlTableSkeleton filas={6} columnas={4} />}>
        <DesgloseDelPeriodo periodo={periodo} />
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
