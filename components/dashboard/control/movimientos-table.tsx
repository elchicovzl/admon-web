'use client'

import Link from 'next/link'
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
  FileText,
  Download,
} from 'lucide-react'

import { anularMovimiento, emitirReciboDeMovimiento } from '@/lib/actions/control.actions'
import type { ContraparteListItem, MovimientoListItem } from '@/lib/types/control.types'
import { formatearMonto, formatearFecha, hoyComoFechaCalendario } from '@/lib/utils/control-format'
import {
  formatearNumeroRecibo,
  puedeEmitirReciboDeFila,
  rutaPdfRecibo,
} from '@/lib/utils/control-recibo'
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
import { SearchableSelect } from '@/components/ui/searchable-select'

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

interface Props {
  movimientos: MovimientoListItem[]
  /** Para elegir el cliente al emitir un recibo de un ingreso sin contraparte. */
  contrapartes: ContraparteListItem[]
}

export function MovimientosTable({ movimientos, contrapartes }: Props) {
  const [anulando, setAnulando] = useState<MovimientoListItem | null>(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)

  const [emitiendo, setEmitiendo] = useState<MovimientoListItem | null>(null)
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [enviandoRecibo, setEnviandoRecibo] = useState(false)

  // Clients first; if none is registered as such, any active counterparty can
  // be the receipt's client (the server only requires a counterparty).
  const activas = contrapartes.filter((c) => c.isActive)
  const clientes = activas.filter((c) => c.tipo === 'CLIENTE')
  const opcionesCliente = (clientes.length > 0 ? clientes : activas).map((c) => ({
    value: c.id,
    label: c.nombre,
  }))

  function cerrarEmision() {
    setEmitiendo(null)
    setClienteId(null)
  }

  async function confirmarEmision() {
    if (!emitiendo) return

    setEnviandoRecibo(true)
    try {
      const resultado = await emitirReciboDeMovimiento({
        movimientoId: emitiendo.id,
        // The server ignores it when the movement already has a counterparty.
        contraparteId: emitiendo.contraparte ? undefined : (clienteId ?? undefined),
      })

      if (resultado.success && resultado.data) {
        const url = rutaPdfRecibo(resultado.data.id)
        toast.success(resultado.message ?? 'Recibo de pago emitido', {
          duration: 15000,
          action: {
            label: 'Descargar recibo',
            onClick: () => window.open(url, '_blank', 'noopener'),
          },
        })
        // May be blocked by the browser outside a user gesture; the toast
        // action above is the reliable path.
        window.open(url, '_blank', 'noopener')
        cerrarEmision()
      } else {
        toast.error(resultado.error ?? 'No se pudo emitir el recibo')
      }
    } catch (error) {
      console.error('[control] emitirReciboDeMovimiento:', error)
      toast.error('Error inesperado al emitir el recibo')
    } finally {
      setEnviandoRecibo(false)
    }
  }

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
              const puedeAnular = !movimiento.estaAnulado && !esAnulacion
              const puedeEmitir = puedeEmitirReciboDeFila(movimiento)

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
                      {movimiento.recibo && (
                        <Badge variant="outline" className="text-xs tabular-nums">
                          {formatearNumeroRecibo(movimiento.recibo.numero)}
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
                    {/* A CUÁL préstamo. Una persona puede tener más de uno
                        abierto, y "Abono a préstamo" sin decir a cuál no se
                        puede rastrear. El link filtra la lista por ese
                        préstamo, en todos los periodos. */}
                    {movimiento.prestamo && (
                      <Link
                        href={`/dashboard/control/movimientos?prestamo=${movimiento.prestamo.id}`}
                        className="block text-xs hover:underline"
                        title={`${movimiento.prestamo.contraparte} · ${formatearFecha(
                          movimiento.prestamo.fechaDesembolso
                        )}`}
                      >
                        {movimiento.prestamo.concepto}
                      </Link>
                    )}
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
                    {(puedeAnular || puedeEmitir || movimiento.recibo) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {puedeEmitir && (
                            <DropdownMenuItem onClick={() => setEmitiendo(movimiento)}>
                              <FileText className="mr-2 h-4 w-4" />
                              Emitir recibo
                            </DropdownMenuItem>
                          )}
                          {/* Un ingreso anulado conserva su recibo: el PDF
                              sale marcado como ANULADO. */}
                          {movimiento.recibo && (
                            <DropdownMenuItem asChild>
                              <a
                                href={rutaPdfRecibo(movimiento.recibo.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Descargar recibo{' '}
                                {formatearNumeroRecibo(movimiento.recibo.numero)}
                              </a>
                            </DropdownMenuItem>
                          )}
                          {puedeAnular && (
                            <DropdownMenuItem onClick={() => setAnulando(movimiento)}>
                              <Ban className="mr-2 h-4 w-4" />
                              Anular
                            </DropdownMenuItem>
                          )}
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

      <Dialog
        open={emitiendo !== null}
        onOpenChange={(abierto) => {
          if (!abierto) cerrarEmision()
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Emitir recibo de pago</DialogTitle>
            <DialogDescription>
              Se genera un recibo con consecutivo para entregarle al cliente. No
              es una factura y no cambia el movimiento.
            </DialogDescription>
          </DialogHeader>

          {emitiendo && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{emitiendo.concepto}</p>
              <p className="text-muted-foreground">
                {formatearFecha(emitiendo.fecha)} · {emitiendo.bolsillo.nombre} ·{' '}
                {formatearMonto(emitiendo.monto)}
              </p>
            </div>
          )}

          {emitiendo?.contraparte ? (
            <p className="text-sm">
              El recibo se emite a nombre de{' '}
              <span className="font-medium">{emitiendo.contraparte.nombre}</span>.
            </p>
          ) : (
            <div className="space-y-2">
              <Label>Cliente</Label>
              <SearchableSelect
                options={opcionesCliente}
                value={clienteId}
                onValueChange={setClienteId}
                placeholder="Seleccioná un cliente…"
                searchPlaceholder="Buscar persona o empresa…"
                disabled={enviandoRecibo}
              />
              <p className="text-xs text-muted-foreground">
                Este ingreso no tiene contraparte. El recibo necesita un cliente y
                queda guardado en el recibo, no en el movimiento.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cerrarEmision} disabled={enviandoRecibo}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarEmision}
              disabled={enviandoRecibo || (!emitiendo?.contraparte && !clienteId)}
            >
              {enviandoRecibo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Emitiendo…
                </>
              ) : (
                'Emitir recibo'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
