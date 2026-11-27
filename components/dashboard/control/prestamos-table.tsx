'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, MoreHorizontal, HandCoins, Ban, ListTree, NotebookPen } from 'lucide-react'

import {
  abonarPrestamo,
  actualizarNotasPrestamo,
  marcarIncobrable,
} from '@/lib/actions/control.actions'
import type { PrestamoListItem, BolsilloListItem, EstadoPrestamo } from '@/lib/types/control.types'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'
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

const BADGE_ESTADO: Record<
  EstadoPrestamo,
  {
    texto: string
    variant: 'default' | 'secondary' | 'outline' | 'destructive'
    className?: string
  }
> = {
  ABIERTO: { texto: 'Abierto', variant: 'default' },
  PARCIAL: { texto: 'Parcial', variant: 'outline' },
  CANCELADO: {
    texto: 'Cancelado',
    variant: 'default',
    className: 'bg-emerald-600 text-white dark:bg-emerald-500',
  },
  INCOBRABLE: { texto: 'Incobrable', variant: 'destructive' },
}

interface Props {
  prestamos: PrestamoListItem[]
  bolsillos: BolsilloListItem[]
}

export function PrestamosTable({ prestamos, bolsillos }: Props) {
  const [abonando, setAbonando] = useState<PrestamoListItem | null>(null)
  const [incobrable, setIncobrable] = useState<PrestamoListItem | null>(null)
  const [editandoNotas, setEditandoNotas] = useState<PrestamoListItem | null>(null)
  const [enviando, setEnviando] = useState(false)

  const [monto, setMonto] = useState('')
  const [bolsilloId, setBolsilloId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [notas, setNotas] = useState('')

  function cerrarDialogos() {
    setAbonando(null)
    setIncobrable(null)
    setEditandoNotas(null)
    setMonto('')
    setBolsilloId('')
    setMotivo('')
    setNotas('')
  }

  function abrirNotas(prestamo: PrestamoListItem) {
    setNotas(prestamo.notas ?? '')
    setEditandoNotas(prestamo)
  }

  async function confirmarNotas() {
    if (!editandoNotas) return
    setEnviando(true)
    try {
      const resultado = await actualizarNotasPrestamo({
        prestamoId: editandoNotas.id,
        notas,
      })

      if (resultado.success) {
        toast.success(resultado.message ?? 'Notas actualizadas')
        cerrarDialogos()
      } else {
        toast.error(resultado.error ?? 'No se pudieron guardar las notas')
      }
    } finally {
      setEnviando(false)
    }
  }

  async function confirmarAbono() {
    if (!abonando) return
    setEnviando(true)
    try {
      const resultado = await abonarPrestamo({
        prestamoId: abonando.id,
        fecha: hoyComoFechaCalendario(),
        monto: Number(monto),
        bolsilloId,
      })

      if (resultado.success) {
        toast.success(resultado.message ?? 'Abono registrado')
        cerrarDialogos()
      } else {
        toast.error(resultado.error ?? 'No se pudo registrar el abono')
      }
    } finally {
      setEnviando(false)
    }
  }

  async function confirmarIncobrable() {
    if (!incobrable) return
    setEnviando(true)
    try {
      const resultado = await marcarIncobrable({
        prestamoId: incobrable.id,
        marcadoIncobrable: !incobrable.marcadoIncobrable,
        motivo: incobrable.marcadoIncobrable ? null : motivo,
      })

      if (resultado.success) {
        toast.success(resultado.message ?? 'Listo')
        cerrarDialogos()
      } else {
        toast.error(resultado.error ?? 'No se pudo actualizar')
      }
    } finally {
      setEnviando(false)
    }
  }

  if (prestamos.length === 0) {
    return (
      <div className="rounded-md border p-12 text-center">
        <p className="text-muted-foreground">No hay préstamos registrados.</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contraparte</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead className="w-[110px]">Desembolso</TableHead>
              <TableHead className="text-right">Original</TableHead>
              <TableHead className="text-right">Abonado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {prestamos.map((prestamo) => {
              const badge = BADGE_ESTADO[prestamo.estado]
              // Pagado del todo: sigue en la lista para auditarlo, pero
              // tachado para que no se lea como deuda viva.
              const tachado = prestamo.estado === 'CANCELADO' && 'line-through opacity-60'

              return (
                <TableRow key={prestamo.id}>
                  <TableCell className={cn('font-medium', tachado)}>
                    {prestamo.contraparte.nombre}
                  </TableCell>
                  <TableCell className={cn('text-sm text-muted-foreground', tachado)}>
                    {prestamo.concepto}
                    {prestamo.notas && (
                      <p className="mt-1 max-w-md whitespace-pre-line text-xs">
                        {prestamo.notas}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className={cn('whitespace-nowrap text-sm', tachado)}>
                    {formatearFecha(prestamo.fechaDesembolso)}
                  </TableCell>
                  <TableCell
                    className={cn('text-right tabular-nums text-muted-foreground', tachado)}
                  >
                    {formatearMonto(prestamo.montoOriginal)}
                  </TableCell>
                  <TableCell
                    className={cn('text-right tabular-nums text-muted-foreground', tachado)}
                  >
                    {formatearMonto(prestamo.totalAbonado)}
                    {prestamo.cantidadAbonos > 0 && (
                      <span className="ml-1 text-xs">
                        ({prestamo.cantidadAbonos})
                      </span>
                    )}
                  </TableCell>
                  {/* El saldo NO es una columna en la base: se deriva de los
                      movimientos cada vez que se lee. */}
                  <TableCell className={cn('text-right tabular-nums font-medium', tachado)}>
                    {formatearMonto(prestamo.saldoActual)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badge.variant} className={badge.className}>
                      {badge.texto}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Abrir menú</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {/* Lo que hace auditable el saldo: de "Abonado
                            $400.000 (2)" se pasa a ver cuáles dos, cuándo y de
                            qué bolsillo. El saldo se deriva de esos
                            movimientos, así que tienen que ser alcanzables. */}
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/control/movimientos?prestamo=${prestamo.id}`}
                          >
                            <ListTree className="mr-2 h-4 w-4" />
                            Ver sus movimientos
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => abrirNotas(prestamo)}>
                          <NotebookPen className="mr-2 h-4 w-4" />
                          {prestamo.notas ? 'Editar notas' : 'Agregar notas'}
                        </DropdownMenuItem>
                        {prestamo.saldoActual > 0 && (
                          <DropdownMenuItem onClick={() => setAbonando(prestamo)}>
                            <HandCoins className="mr-2 h-4 w-4" />
                            Registrar abono
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setIncobrable(prestamo)}>
                          <Ban className="mr-2 h-4 w-4" />
                          {prestamo.marcadoIncobrable
                            ? 'Reactivar'
                            : 'Marcar incobrable'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Abono */}
      <Dialog open={abonando !== null} onOpenChange={(o) => !o && cerrarDialogos()}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Registrar abono</DialogTitle>
            <DialogDescription>
              Entra como movimiento de ingreso ligado al préstamo. El saldo se
              recalcula solo.
            </DialogDescription>
          </DialogHeader>

          {abonando && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{abonando.contraparte.nombre}</p>
              <p className="text-muted-foreground">
                {abonando.concepto} · debe {formatearMonto(abonando.saldoActual)}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="abono-monto">Monto</Label>
              <Input
                id="abono-monto"
                type="number"
                min={1}
                step={1}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                disabled={enviando}
              />
            </div>
            <div className="space-y-2">
              <Label>Entra a</Label>
              <Select value={bolsilloId} onValueChange={setBolsilloId} disabled={enviando}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná el bolsillo…" />
                </SelectTrigger>
                <SelectContent>
                  {bolsillos.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cerrarDialogos} disabled={enviando}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarAbono}
              disabled={enviando || Number(monto) <= 0 || !bolsilloId}
            >
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar abono
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notas */}
      <Dialog open={editandoNotas !== null} onOpenChange={(o) => !o && cerrarDialogos()}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Notas del préstamo</DialogTitle>
            <DialogDescription>
              Solo cambia el texto. Montos, fechas y movimientos no se tocan.
            </DialogDescription>
          </DialogHeader>

          {editandoNotas && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{editandoNotas.contraparte.nombre}</p>
              <p className="text-muted-foreground">{editandoNotas.concepto}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notas-prestamo">Notas</Label>
            <Textarea
              id="notas-prestamo"
              rows={6}
              maxLength={2000}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              disabled={enviando}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cerrarDialogos} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={confirmarNotas} disabled={enviando}>
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Incobrable */}
      <Dialog open={incobrable !== null} onOpenChange={(o) => !o && cerrarDialogos()}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {incobrable?.marcadoIncobrable
                ? 'Reactivar préstamo'
                : 'Marcar como incobrable'}
            </DialogTitle>
            <DialogDescription>
              {incobrable?.marcadoIncobrable
                ? 'Vuelve a contar como préstamo vivo y su estado se deriva del saldo.'
                : 'Es lo único del estado que no se calcula: es una decisión, y por eso exige motivo. El préstamo no desaparece de la lista.'}
            </DialogDescription>
          </DialogHeader>

          {!incobrable?.marcadoIncobrable && (
            <div className="space-y-2">
              <Label htmlFor="motivo-incobrable">Motivo</Label>
              <Textarea
                id="motivo-incobrable"
                rows={3}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                disabled={enviando}
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cerrarDialogos} disabled={enviando}>
              Cancelar
            </Button>
            <Button
              variant={incobrable?.marcadoIncobrable ? 'default' : 'destructive'}
              onClick={confirmarIncobrable}
              disabled={
                enviando ||
                (!incobrable?.marcadoIncobrable && motivo.trim().length === 0)
              }
            >
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
