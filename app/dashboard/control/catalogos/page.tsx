import { Suspense } from 'react'
import type { Metadata } from 'next'

import {
  getBolsillos,
  getCategorias,
  getTiposServicio,
  getContrapartes,
  getServiciosAlegra,
} from '@/lib/actions/control.actions'
import { CatalogosClient } from '@/components/dashboard/control/catalogos-client'
import { ControlTableSkeleton } from '@/components/dashboard/control/control-skeletons'

export const metadata: Metadata = {
  title: 'Catálogos | Control',
  description: 'Bolsillos, categorías, servicios y contrapartes',
}

async function Catalogos() {
  // Se piden CON inactivos: esta es la única pantalla desde donde se puede
  // reactivar algo, así que esconderlos lo volvería un camino de ida.
  const [bolsillos, categorias, tiposServicio, contrapartes, serviciosAlegra] =
    await Promise.all([
      getBolsillos(true),
      getCategorias(true),
      getTiposServicio(true),
      getContrapartes(true),
      getServiciosAlegra(true),
    ])

  return (
    <CatalogosClient
      bolsillos={bolsillos.data ?? []}
      categorias={categorias.data ?? []}
      tiposServicio={tiposServicio.data ?? []}
      contrapartes={contrapartes.data ?? []}
      serviciosAlegra={serviciosAlegra.data ?? []}
    />
  )
}

export default function CatalogosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Catálogos</h1>
        <p className="text-muted-foreground">
          Nada se borra: se desactiva. Los movimientos históricos apuntan acá y
          tienen que poder seguir existiendo.
        </p>
      </div>

      <Suspense fallback={<ControlTableSkeleton filas={8} columnas={4} />}>
        <Catalogos />
      </Suspense>
    </div>
  )
}
