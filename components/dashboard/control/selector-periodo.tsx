'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

import { formatearPeriodo, periodoActual } from '@/lib/utils/control-format'
import { periodoAnterior } from '@/lib/utils/control-ledger'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** "2026-12" → "2027-01". */
function periodoSiguiente(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number)
  return mes === 12
    ? `${anio + 1}-01`
    : `${anio}-${String(mes + 1).padStart(2, '0')}`
}

/**
 * Lista de periodos ofrecidos: los doce meses anteriores al actual y los tres
 * siguientes. Se agrega el periodo mirado aunque caiga fuera del rango, para
 * que un enlace a un mes viejo no muestre el selector vacío.
 */
function periodosDisponibles(actual: string): string[] {
  const hoy = periodoActual()
  const lista: string[] = []
  let p = hoy
  for (let i = 0; i < 3; i++) p = periodoSiguiente(p)
  for (let i = 0; i < 16; i++) {
    lista.push(p)
    p = periodoAnterior(p)
  }
  if (!lista.includes(actual)) lista.push(actual)
  return [...new Set(lista)].sort().reverse()
}

export function SelectorPeriodo({ periodo }: { periodo: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function ir(nuevo: string) {
    // Se conservan los demás parámetros: un filtro de bolsillo no debería
    // perderse solo por cambiar de mes.
    const params = new URLSearchParams(searchParams.toString())
    params.set('periodo', nuevo)
    router.push(`${pathname}?${params.toString()}`)
  }

  const esActual = periodo === periodoActual()

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        aria-label="Mes anterior"
        onClick={() => ir(periodoAnterior(periodo))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Select value={periodo} onValueChange={ir}>
        <SelectTrigger className="w-[180px]">
          <CalendarDays className="mr-2 h-4 w-4 shrink-0 opacity-60" />
          <SelectValue>{formatearPeriodo(periodo)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {periodosDisponibles(periodo).map((p) => (
            <SelectItem key={p} value={p}>
              {formatearPeriodo(p)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        aria-label="Mes siguiente"
        onClick={() => ir(periodoSiguiente(periodo))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {!esActual && (
        <Button variant="ghost" size="sm" onClick={() => ir(periodoActual())}>
          Hoy
        </Button>
      )}
    </div>
  )
}
