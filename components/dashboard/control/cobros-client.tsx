'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Check, ExternalLink } from 'lucide-react'
import Link from 'next/link'

import { importarCotizacionesComoIngresos } from '@/lib/actions/control.actions'
import type { CotizacionesDelPeriodo } from '@/lib/types/control.types'
import { formatearMonto } from '@/lib/utils/control-format'
import { Monto } from './monto'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function CobrosClient({ datos }: { datos: CotizacionesDelPeriodo }) {
  const pendientes = datos.cotizaciones.filter((c) => !c.yaRegistrada)
  const [seleccion, setSeleccion] = useState<Set<string>>(
    // Todo lo pendiente viene marcado: el caso normal es importar el mes
    // entero, y desmarcar dos es menos trabajo que marcar veinte.
    () => new Set(pendientes.map((c) => c.estimateId))
  )
  const [enviando, setEnviando] = useState(false)

  const elegidas = datos.cotizaciones.filter(
    (c) => !c.yaRegistrada && seleccion.has(c.estimateId)
  )
  const totalElegido = elegidas.reduce((a, c) => a + c.total, 0)

  function alternar(id: string) {
    setSeleccion((actual) => {
      const copia = new Set(actual)
      if (copia.has(id)) copia.delete(id)
      else copia.add(id)
      return copia
    })
  }

  async function importar() {
    setEnviando(true)
    try {
      const r = await importarCotizacionesComoIngresos({
        periodo: datos.periodo,
        estimateIds: [...seleccion],
      })
      if (r.success) {
        toast.success(r.message ?? 'Ingresos registrados')
        setSeleccion(new Set())
      } else {
        toast.error(r.error ?? 'No se pudo importar')
      }
    } finally {
      setEnviando(false)
    }
  }

  if (datos.cotizaciones.length === 0) {
    return (
      <div className="rounded-md border p-12 text-center">
        <p className="text-muted-foreground">
          No hay cotizaciones de Alegra en este periodo.
        </p>
      </div>
    )
  }

  const todasMarcadas =
    pendientes.length > 0 && pendientes.every((c) => seleccion.has(c.estimateId))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
        <p className="text-sm">
          {elegidas.length === 0 ? (
            <span className="text-muted-foreground">
              No hay cotizaciones seleccionadas
            </span>
          ) : (
            <>
              <span className="font-medium">{elegidas.length}</span>{' '}
              cotización{elegidas.length === 1 ? '' : 'es'} por{' '}
              <span className="font-medium tabular-nums">
                {formatearMonto(totalElegido)}
              </span>{' '}
              <span className="text-muted-foreground">→ entran a IVONE</span>
            </>
          )}
        </p>
        <Button disabled={enviando || elegidas.length === 0} onClick={importar}>
          {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Registrar como ingresos
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={todasMarcadas}
                  disabled={pendientes.length === 0}
                  aria-label="Seleccionar todas"
                  onCheckedChange={(v) =>
                    setSeleccion(
                      v ? new Set(pendientes.map((c) => c.estimateId)) : new Set()
                    )
                  }
                />
              </TableHead>
              <TableHead className="w-[110px]">Fecha</TableHead>
              <TableHead className="w-[80px]">Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-[150px]">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {datos.cotizaciones.map((c) => (
              <TableRow
                key={c.estimateId}
                className={cn(c.yaRegistrada && 'opacity-60')}
              >
                <TableCell>
                  <Checkbox
                    checked={seleccion.has(c.estimateId)}
                    disabled={c.yaRegistrada || enviando}
                    aria-label={`Seleccionar cotización ${c.numero}`}
                    onCheckedChange={() => alternar(c.estimateId)}
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {c.fecha.slice(0, 10)}
                </TableCell>
                <TableCell className="tabular-nums text-sm">
                  <Link
                    href={`/dashboard/finances/estimates/${c.estimateId}`}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    {c.numero}
                    <ExternalLink className="h-3 w-3 opacity-50" />
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{c.cliente}</TableCell>
                <TableCell className="text-right">
                  <Monto valor={c.total} />
                </TableCell>
                <TableCell>
                  {c.yaRegistrada ? (
                    <Badge variant="secondary" className="gap-1">
                      <Check className="h-3 w-3" />
                      Ya registrada
                    </Badge>
                  ) : (
                    <Badge variant="outline">Pendiente</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
