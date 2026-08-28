import { Suspense } from 'react'
import type { Metadata } from 'next'

import {
  getMovimientos,
  getBolsillos,
  getCategorias,
  getContrapartes,
  getServiciosAlegra,
} from '@/lib/actions/control.actions'
import {
  formatearPeriodo,
  periodoActual,
  formatearMonto,
} from '@/lib/utils/control-format'
import { MovimientosTable } from '@/components/dashboard/control/movimientos-table'
import { MovimientoFormDialog } from '@/components/dashboard/control/movimiento-form-dialog'
import { MovimientosFiltros } from '@/components/dashboard/control/movimientos-filtros'
import { Paginador } from '@/components/dashboard/control/paginador'
import { ControlTableSkeleton } from '@/components/dashboard/control/control-skeletons'
import { SelectorPeriodo } from '@/components/dashboard/control/selector-periodo'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = {
  title: 'Movimientos | Control',
  description: 'Movimientos del libro de caja interno',
}

interface PageProps {
  searchParams: Promise<{
    periodo?: string
    bolsillo?: string
    categoria?: string
    contraparte?: string
    prestamo?: string
    buscar?: string
    pagina?: string
    tam?: string
  }>
}

async function Listado({
  periodo,
  bolsillo,
  categoria,
  contraparte,
  prestamo,
  buscar,
  pagina,
  tam,
}: {
  periodo: string
  bolsillo?: string
  categoria?: string
  contraparte?: string
  prestamo?: string
  buscar?: string
  pagina: number
  tam: number
}) {
  const resultado = await getMovimientos({
    /**
     * Un préstamo se desembolsa un mes y se abona en otros. Cruzarlo con el
     * periodo mostraría un abono suelto y escondería el desembolso, que es
     * justo lo que se quiere ver al auditar un saldo.
     */
    periodo: prestamo ? undefined : periodo,
    bolsilloId: bolsillo,
    categoriaId: categoria,
    contraparteId: contraparte,
    prestamoId: prestamo,
    buscar,
    page: pagina,
    pageSize: tam,
  })

  if (!resultado.success || !resultado.data) {
    return (
      <div className="rounded-md border border-destructive/50 p-6 text-sm text-destructive">
        {resultado.error}
      </div>
    )
  }

  const d = resultado.data

  return (
    <div className="space-y-3">
      {/* El total es el de TODO lo filtrado, no el de la página: si cambiara al
          pasar de página, nadie volvería a confiar en el número. */}
      <p className="text-sm text-muted-foreground">
        Suma de lo filtrado:{' '}
        <span className="font-medium tabular-nums text-foreground">
          {formatearMonto(d.sumaFiltrada)}
        </span>
      </p>

      <MovimientosTable movimientos={d.items} />

      <Paginador
        page={d.page}
        totalPages={d.totalPages}
        totalCount={d.totalCount}
        pageSize={d.pageSize}
        etiqueta="movimientos"
      />
    </div>
  )
}

/**
 * Los catálogos se piden por separado en cada bloque, y no se duplican
 * consultas: las actions están envueltas en `cache()` de React, así que las
 * tres llamadas se resuelven una sola vez por request.
 *
 * Van aparte del listado a propósito: el operador tiene que poder filtrar o
 * abrir el formulario sin esperar a que se resuelvan los movimientos.
 */
async function catalogos() {
  const [bolsillos, categorias, contrapartes, serviciosAlegra] = await Promise.all([
    getBolsillos(),
    getCategorias(),
    getContrapartes(),
    getServiciosAlegra(),
  ])
  return {
    bolsillos: bolsillos.data ?? [],
    categorias: categorias.data ?? [],
    contrapartes: contrapartes.data ?? [],
    serviciosAlegra: serviciosAlegra.data ?? [],
  }
}

async function Filtros() {
  return <MovimientosFiltros {...(await catalogos())} />
}

async function BotonNuevo() {
  return <MovimientoFormDialog {...(await catalogos())} />
}

export default async function MovimientosPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const periodo = sp.periodo ?? periodoActual()
  const pagina = Math.max(1, Number(sp.pagina) || 1)
  const tam = Number(sp.tam) || 25

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Movimientos</h1>
          {/* Filtrando por préstamo se muestran todos los periodos: decirlo
              evita que el número se lea como si fuera solo del mes. */}
          <p className="text-muted-foreground">
            {sp.prestamo
              ? 'Un préstamo · todos los periodos'
              : formatearPeriodo(periodo)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SelectorPeriodo periodo={periodo} />
          <Suspense fallback={<Skeleton className="h-9 w-40" />}>
            <BotonNuevo />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<Skeleton className="h-[68px] w-full" />}>
        <Filtros />
      </Suspense>

      <Suspense
        key={`${periodo}-${sp.bolsillo}-${sp.categoria}-${sp.contraparte}-${sp.prestamo}-${sp.buscar}-${pagina}-${tam}`}
        fallback={<ControlTableSkeleton filas={10} columnas={7} />}
      >
        <Listado
          periodo={periodo}
          bolsillo={sp.bolsillo}
          categoria={sp.categoria}
          contraparte={sp.contraparte}
          prestamo={sp.prestamo}
          buscar={sp.buscar}
          pagina={pagina}
          tam={tam}
        />
      </Suspense>
    </div>
  )
}
