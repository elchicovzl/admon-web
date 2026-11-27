'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

import { SearchableSelect } from '@/components/ui/searchable-select'

const TODAS = '__todas__'

interface Props {
  contrapartes: { id: string; nombre: string }[]
}

/** Filtra los préstamos por contraparte. Solo ofrece las que tienen préstamos. */
export function PrestamosFiltro({ contrapartes }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function aplicar(valor: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (!valor || valor === TODAS) params.delete('contraparte')
    else params.set('contraparte', valor)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <div className="w-60">
      <SearchableSelect
        options={[
          { value: TODAS, label: 'Todas las contrapartes' },
          ...contrapartes.map((c) => ({ value: c.id, label: c.nombre })),
        ]}
        value={searchParams.get('contraparte') ?? TODAS}
        onValueChange={aplicar}
        placeholder="Todas las contrapartes"
        searchPlaceholder="Buscar contraparte…"
      />
    </div>
  )
}
