import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AlertTriangle, Info } from 'lucide-react'

import { getCotizacionesDelPeriodo } from '@/lib/actions/control.actions'
import {
  formatearMonto,
  formatearPeriodo,
  periodoActual,
} from '@/lib/utils/control-format'
import { CobrosClient } from '@/components/dashboard/control/cobros-client'
import { SelectorPeriodo } from '@/components/dashboard/control/selector-periodo'
import { ControlTableSkeleton } from '@/components/dashboard/control/control-skeletons'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export const metadata: Metadata = {
  title: 'Cobros | Control',
  description: 'Cotizaciones de Alegra registradas como ingresos',
}

interface PageProps {
  searchParams: Promise<{ periodo?: string }>
}

async function Cobros({ periodo }: { periodo: string }) {
  const resultado = await getCotizacionesDelPeriodo(periodo)

  if (!resultado.success || !resultado.data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>No se pudo leer Alegra</AlertTitle>
        <AlertDescription>{resultado.error}</AlertDescription>
      </Alert>
    )
  }

  const d = resultado.data

  return (
    <div className="space-y-4">
      {d.posiblementeIncompleto && (
        <Alert variant={d.cotizaciones.length === 0 ? 'default' : 'destructive'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>La búsqueda en Alegra quedó corta</AlertTitle>
          <AlertDescription>
            {d.cotizaciones.length === 0 ? (
              <>
                No apareció ninguna cotización, pero la búsqueda llegó al tope de
                páginas antes de cubrir el mes. Puede ser que no haya ninguna —
                los ingresos se empezaron a manejar con cotizaciones en{' '}
                <strong>abril de 2026</strong>, así que antes de esa fecha esto es
                lo esperado— o que estén más atrás de donde alcanzó a mirar.
              </>
            ) : (
              <>
                Lo que ves es un piso, no el total: la consulta llegó al tope de
                páginas antes de cubrir todo el mes. Revisá el mes en Finanzas
                antes de darlo por cerrado.
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-6 text-sm">
        <div>
          <p className="text-muted-foreground">Cotizado en el mes</p>
          <p className="text-lg font-bold tabular-nums">
            {formatearMonto(d.totalCotizado)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Falta registrar</p>
          <p className="text-lg font-bold tabular-nums">
            {formatearMonto(d.totalPendiente)}{' '}
            <span className="text-sm font-normal text-muted-foreground">
              ({d.cantidadPendiente})
            </span>
          </p>
        </div>
      </div>

      <CobrosClient datos={d} />
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
            Cotizaciones de Alegra · {formatearPeriodo(periodo)}
          </p>
        </div>
        <SelectorPeriodo periodo={periodo} />
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Cómo funciona</AlertTitle>
        <AlertDescription>
          Alegra <strong>no guarda si una cotización se cobró</strong> — no tiene
          estado ni saldo, es un documento informativo. Acá, &quot;registrada&quot;
          significa que ya existe el ingreso en el libro de caja. Los ingresos
          entran a <strong>IVONE</strong> y llevan la fecha de la cotización, que
          es lo más cercano que hay a la fecha de cobro.
        </AlertDescription>
      </Alert>

      <Suspense
        key={periodo}
        fallback={<ControlTableSkeleton filas={8} columnas={6} />}
      >
        <Cobros periodo={periodo} />
      </Suspense>
    </div>
  )
}
