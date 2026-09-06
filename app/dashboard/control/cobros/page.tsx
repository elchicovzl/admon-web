import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AlertTriangle, Info } from 'lucide-react'

import {
  getCotizacionesDelPeriodo,
  getFacturasDelPeriodo,
  getBolsillos,
} from '@/lib/actions/control.actions'
import {
  formatearMonto,
  formatearPeriodo,
  periodoActual,
} from '@/lib/utils/control-format'
import { CobrosClient } from '@/components/dashboard/control/cobros-client'
import { FacturasClient } from '@/components/dashboard/control/facturas-client'
import { SelectorPeriodo } from '@/components/dashboard/control/selector-periodo'
import { ControlTableSkeleton } from '@/components/dashboard/control/control-skeletons'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const metadata: Metadata = {
  title: 'Cobros | Control',
  description: 'Ingresos por cotización y por factura',
}

interface PageProps {
  searchParams: Promise<{ periodo?: string }>
}

/** Par de números al pie de cada pestaña. */
function Cifras({ items }: { items: { etiqueta: string; valor: string; nota?: string }[] }) {
  return (
    <div className="flex flex-wrap gap-6 text-sm">
      {items.map((i) => (
        <div key={i.etiqueta}>
          <p className="text-muted-foreground">{i.etiqueta}</p>
          <p className="text-lg font-bold tabular-nums">{i.valor}</p>
          {i.nota && <p className="text-xs text-muted-foreground">{i.nota}</p>}
        </div>
      ))}
    </div>
  )
}

async function Cotizaciones({ periodo }: { periodo: string }) {
  const r = await getCotizacionesDelPeriodo(periodo)

  if (!r.success || !r.data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>No se pudo leer Alegra</AlertTitle>
        <AlertDescription>{r.error}</AlertDescription>
      </Alert>
    )
  }

  const d = r.data

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Ingresos &quot;por debajo&quot;</AlertTitle>
        <AlertDescription>
          <p>
            Alegra <strong>no guarda si una cotización se cobró</strong> — no tiene
            estado ni saldo. Acá &quot;registrada&quot; significa que ya existe el
            ingreso en el libro. Entran a <strong>IVONE</strong> con la fecha de la
            cotización, que es lo más cercano que hay a la fecha de cobro.
          </p>
        </AlertDescription>
      </Alert>

      {d.posiblementeIncompleto && (
        <Alert variant={d.cotizaciones.length === 0 ? 'default' : 'destructive'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>La búsqueda en Alegra quedó corta</AlertTitle>
          <AlertDescription>
            <p>
              {d.cotizaciones.length === 0 ? (
                <>
                  No apareció ninguna cotización. Los ingresos se empezaron a
                  manejar con cotizaciones en <strong>abril de 2026</strong>, así
                  que antes de esa fecha esto es lo esperado.
                </>
              ) : (
                <>
                  Lo que ves es un piso, no el total: la consulta llegó al tope de
                  páginas antes de cubrir el mes.
                </>
              )}
            </p>
          </AlertDescription>
        </Alert>
      )}

      <Cifras
        items={[
          { etiqueta: 'Cotizado en el mes', valor: formatearMonto(d.totalCotizado) },
          {
            etiqueta: 'Falta registrar',
            valor: formatearMonto(d.totalPendiente),
            nota: `${d.cantidadPendiente} cotizaciones`,
          },
        ]}
      />

      <CobrosClient datos={d} />
    </div>
  )
}

async function Facturas({ periodo }: { periodo: string }) {
  const [r, bolsillos] = await Promise.all([
    getFacturasDelPeriodo(periodo),
    getBolsillos(),
  ])

  if (!r.success || !r.data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>No se pudo leer Alegra</AlertTitle>
        <AlertDescription>{r.error}</AlertDescription>
      </Alert>
    )
  }

  const d = r.data

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Ingresos &quot;por arriba&quot;</AlertTitle>
        <AlertDescription>
          <p>
            La factura <strong>sí sabe cuánto se cobró</strong>: trae estado y
            saldo. Por eso el ingreso se registra por lo <strong>cobrado</strong>,
            no por lo facturado — una factura a medio pagar solo metió en caja lo
            que se pagó. Las que no cobraron nada no se pueden registrar.
          </p>
        </AlertDescription>
      </Alert>

      <Cifras
        items={[
          {
            etiqueta: 'Facturado en el mes',
            valor: formatearMonto(d.totalFacturado),
            nota: 'cobrado o no',
          },
          {
            etiqueta: 'Cobrado',
            valor: formatearMonto(d.totalCobrado),
            nota: 'lo que realmente entró',
          },
          {
            etiqueta: 'Falta registrar',
            valor: formatearMonto(d.totalPendienteDeRegistrar),
            nota: `${d.cantidadPendiente} facturas`,
          },
        ]}
      />

      <FacturasClient datos={d} bolsillos={bolsillos.data ?? []} />
    </div>
  )
}

export default async function CobrosPage({ searchParams }: PageProps) {
  const { periodo: p } = await searchParams
  const periodo = p ?? periodoActual()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cobros</h1>
          <p className="text-muted-foreground">
            Ingresos del libro · {formatearPeriodo(periodo)}
          </p>
        </div>
        <SelectorPeriodo periodo={periodo} />
      </div>

      {/* Las dos pestañas son dos naturalezas de ingreso, no dos vistas del
          mismo dato: por eso también son dos grupos de categoría distintos y
          los reportes las muestran separadas. */}
      <Tabs defaultValue="cotizaciones">
        <TabsList>
          <TabsTrigger value="cotizaciones">Cotizaciones (C)</TabsTrigger>
          <TabsTrigger value="facturas">Facturas (F)</TabsTrigger>
        </TabsList>

        <TabsContent value="cotizaciones">
          <Suspense
            key={`c-${periodo}`}
            fallback={<ControlTableSkeleton filas={8} columnas={6} />}
          >
            <Cotizaciones periodo={periodo} />
          </Suspense>
        </TabsContent>

        <TabsContent value="facturas">
          <Suspense
            key={`f-${periodo}`}
            fallback={<ControlTableSkeleton filas={8} columnas={8} />}
          >
            <Facturas periodo={periodo} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
