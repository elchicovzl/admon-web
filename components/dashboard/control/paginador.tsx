'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const TAMANOS = [25, 50, 100, 200]

interface Props {
  page: number
  totalPages: number
  totalCount: number
  pageSize: number
  /** Qué se está contando, en plural: "movimientos", "préstamos". */
  etiqueta?: string
}

export function Paginador({
  page,
  totalPages,
  totalCount,
  pageSize,
  etiqueta = 'registros',
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function ir(cambios: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null) params.delete(k)
      else params.set(k, v)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const desde = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const hasta = Math.min(page * pageSize, totalCount)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {totalCount === 0
          ? `Sin ${etiqueta}`
          : `${desde}–${hasta} de ${totalCount} ${etiqueta}`}
      </p>

      <div className="flex items-center gap-2">
        <Select
          value={String(pageSize)}
          // Cambiar el tamaño vuelve a la página 1: quedarse en la 4 con un
          // tamaño mayor puede dejar la tabla vacía y parecer un error.
          onValueChange={(v) => ir({ tam: v, pagina: null })}
        >
          <SelectTrigger className="h-8 w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TAMANOS.map((t) => (
              <SelectItem key={t} value={String(t)}>
                {t} por página
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => ir({ pagina: page - 1 <= 1 ? null : String(page - 1) })}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>

        <span className="text-sm tabular-nums text-muted-foreground">
          {page} / {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => ir({ pagina: String(page + 1) })}
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
