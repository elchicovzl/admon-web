'use client'

import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

import type {
  BolsilloListItem,
  CategoriaListItem,
  ContraparteListItem,
} from '@/lib/types/control.types'
import { ETIQUETA_GRUPO } from './etiquetas'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'

const TODOS = '__todos__'

interface Props {
  bolsillos: BolsilloListItem[]
  categorias: CategoriaListItem[]
  contrapartes: ContraparteListItem[]
}

export function MovimientosFiltros({ bolsillos, categorias, contrapartes }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [texto, setTexto] = useState(searchParams.get('buscar') ?? '')

  /**
   * Cambiar cualquier filtro vuelve a la página 1.
   *
   * Sin esto, filtrar estando en la página 4 de un listado que ahora tiene dos
   * páginas muestra una tabla vacía, y parece que el filtro no encontró nada.
   */
  function aplicar(cambios: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === '' || valor === TODOS) params.delete(clave)
      else params.set(clave, valor)
    }
    params.delete('pagina')
    router.push(`${pathname}?${params.toString()}`)
  }

  const bolsilloId = searchParams.get('bolsillo')
  const categoriaId = searchParams.get('categoria')
  const contraparteId = searchParams.get('contraparte')
  const hayFiltros = Boolean(
    bolsilloId || categoriaId || contraparteId || searchParams.get('buscar')
  )

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-3">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          aplicar({ buscar: texto })
        }}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar en concepto o notas…"
            className="w-60 pl-8"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Buscar
        </Button>
      </form>

      <div className="w-44">
        <SearchableSelect
          options={[
            { value: TODOS, label: 'Todos los bolsillos' },
            ...bolsillos.map((b) => ({ value: b.id, label: b.nombre })),
          ]}
          value={bolsilloId ?? TODOS}
          onValueChange={(v) => aplicar({ bolsillo: v })}
          placeholder="Todos los bolsillos"
          searchPlaceholder="Buscar bolsillo…"
        />
      </div>

      <div className="w-56">
        <SearchableSelect
          options={[
            { value: TODOS, label: 'Todas las categorías' },
            ...categorias.map((c) => ({
              value: c.id,
              label: `${c.nombre} · ${ETIQUETA_GRUPO[c.grupo] ?? c.grupo}`,
            })),
          ]}
          value={categoriaId ?? TODOS}
          onValueChange={(v) => aplicar({ categoria: v })}
          placeholder="Todas las categorías"
          searchPlaceholder="Buscar categoría…"
        />
      </div>

      <div className="w-48">
        <SearchableSelect
          options={[
            { value: TODOS, label: 'Todas las contrapartes' },
            ...contrapartes.map((c) => ({ value: c.id, label: c.nombre })),
          ]}
          value={contraparteId ?? TODOS}
          onValueChange={(v) => aplicar({ contraparte: v })}
          placeholder="Todas las contrapartes"
          searchPlaceholder="Buscar contraparte…"
        />
      </div>

      {hayFiltros && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setTexto('')
            aplicar({ buscar: null, bolsillo: null, categoria: null, contraparte: null })
          }}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Limpiar
        </Button>
      )}
    </div>
  )
}
