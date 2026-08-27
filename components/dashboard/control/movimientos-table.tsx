'use client'

import { useState } from 'react'
import { TipoMovimiento } from '@prisma/client'
import { toast } from 'sonner'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  MoreHorizontal,
  Ban,
  Loader2,
} from 'lucide-react'

import { anularMovimiento } from '@/lib/actions/control.actions'
import type { MovimientoListItem } from '@/lib/types/control.types'
import { formatearMonto, formatearFecha, hoyComoFechaCalendario } from '@/lib/utils/control-format'
import { cn } from '@/lib/utils'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const ICONO_TIPO = {
  INGRESO: ArrowDownCircle,
  EGRESO: ArrowUpCircle,
  TRASLADO: ArrowLeftRight,
} as const

/** Verde entra, rojo sale, neutro se mueve de bolsillo sin cambiar el total. */
const COLOR_TIPO = {
  INGRESO: 'text-emerald-600 dark:text-emerald-400',
  EGRESO: 'text-red-600 dark:text-red-400',
  TRASLADO: 'text-muted-foreground',
} as const

export function MovimientosTable({ movimientos }: { movimientos: MovimientoListItem[] }) {
  const [anulando, setAnulando] = useState<MovimientoListItem | null>(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function confirmarAnulacion() {
    if (!anulando) return

    setEnviando(true)
    try {
      const resultado = await anularMovimiento({
        movimientoId: anulando.id,
        motivo,
        fecha: hoyComoFechaCalendario(),
      })

      if (resultado.success) {
        toast.success(resultado.message ?? 'Movimiento anulado')
        setAnulando(null)
        setMotivo('')
      } else {
        toast.error(resultado.error ?? 'No se pudo anular')
      }
    } catch (error) {
      console.error('[control] anularMovimiento:', error)
      toast.error('Error inesperado al anular')
    } finally {
      setEnviando(false)
    }
  }

  if (movimientos.length === 0) {
    return (
      <div className="rounded-md border p-12 text-center">
        <p className="text-muted-foreground">
          No hay movimientos en este periodo.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Fecha</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Bolsillo</TableHead>
              <TableHead>Contraparte</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {movimientos.map((movimiento) => {
              const Icono = ICONO_TIPO[movimiento.tipo]
              const esAnulacion = movimiento.anulaMovimientoId !== null

              return (
                <TableRow
                  key={movimiento.id}
                  // Un movimiento anulado NO se oculta: sigue existiendo y su
                  // contra-movimiento está al lado. Se atenúa, nada más.
                  className={cn(movimiento.estaAnulado && 'opacity-50')}
                >
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatearFecha(movimiento.fecha)}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'font-medium',
                          movimiento.estaAnulado && 'line-through'
                        )}
                      >
                        {movimiento.concepto}
                      </span>
                      {movimiento.estaAnulado && (
                        <Badge variant="outline" className="text-xs">
                          Anulado
                        </Badge>
                      )}
                      {esAnulacion && (
                        <Badge variant="secondary" className="text-xs">
                          Anulación
                        </Badge>
                      )}
                    </div>
                    {movimiento.notas && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {movimiento.notas}
                      </p>
                    )}
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {movimiento.categoria.nombre}
                  </TableCell>

                  <TableCell className="text-sm">
                    {movimiento.bolsillo.nombre}
                    {movimiento.bolsilloDestino && (
                      <span className="text-muted-foreground">
                        {' → '}
                        {movimiento.bolsilloDestino.nombre}
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {movimiento.contraparte?.nombre ?? '—'}
                  </TableCell>

                  <TableCell className="text-right whitespace-nowrap">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 font-medium tabular-nums',
                        COLOR_TIPO[movimiento.tipo]
                      )}
                    >
                      <Icono className="h-3.5 w-3.5" />
                      {formatearMonto(movimiento.monto)}
                    </span>
                  </TableCell>

                  <TableCell>
                    {!movimiento.estaAnulado && !esAnulacion && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setAnulando(movimiento)}>
                            <Ban className="mr-2 h-4 w-4" />
                            Anular
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={anulando !== null}
        onOpenChange={(abierto) => {
          if (!abierto) {
            setAnulando(null)
            setMotivo('')
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Anular movimiento</DialogTitle>
            <DialogDescription>
              No se borra nada. Se crea un movimiento espejo que lo revierte, y
              los dos quedan a la vista con el motivo.
            </DialogDescription>
          </DialogHeader>

          {anulando && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{anulando.concepto}</p>
              <p className="text-muted-foreground">
                {formatearFecha(anulando.fecha)} · {anulando.bolsillo.nombre} ·{' '}
                {formatearMonto(anulando.monto)}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="motivo-anulacion">Motivo</Label>
            <Textarea
              id="motivo-anulacion"
              rows={3}
              placeholder="Se cargó dos veces por error"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={enviando}
            />
            <p className="text-xs text-muted-foreground">
              Una anulación sin explicación es el mismo agujero que dejaba el
              Excel. Mínimo 5 caracteres.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setAnulando(null)}
              disabled={enviando}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarAnulacion}
              disabled={enviando || motivo.trim().length < 5}
            >
              {enviando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Anulando…
                </>
              ) : (
                'Anular'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
