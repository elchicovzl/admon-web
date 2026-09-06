'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'

import { registrarPataServicio } from '@/lib/actions/control.actions'
import type {
  ServicioReferenciadoListItem,
  BolsilloListItem,
  EstadoServicio,
} from '@/lib/types/control.types'
import { formatearMonto, formatearFecha, hoyComoFechaCalendario } from '@/lib/utils/control-format'

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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const BADGE_ESTADO: Record<
  EstadoServicio,
  { texto: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  PENDIENTE_COBRO: { texto: 'Sin cobrar', variant: 'outline' },
  COBRADO_SIN_ENTREGAR: { texto: 'Cobrado, falta entregar', variant: 'destructive' },
  ENTREGADO_SIN_COBRAR: { texto: 'Entregado, falta cobrar', variant: 'destructive' },
  COMPLETO: { texto: 'Completo', variant: 'secondary' },
}

interface Props {
  servicios: ServicioReferenciadoListItem[]
  bolsillos: BolsilloListItem[]
}

export function ServiciosTable({ servicios, bolsillos }: Props) {
  const [registrando, setRegistrando] = useState<{
    servicio: ServicioReferenciadoListItem
    pata: 'INGRESO' | 'EGRESO'
  } | null>(null)
  const [bolsilloId, setBolsilloId] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    if (!registrando) return
    setEnviando(true)
    try {
      const resultado = await registrarPataServicio({
        servicioId: registrando.servicio.id,
        pata: registrando.pata,
        fecha: hoyComoFechaCalendario(),
        bolsilloId,
      })

      if (resultado.success) {
        toast.success(resultado.message ?? 'Listo')
        setRegistrando(null)
        setBolsilloId('')
      } else {
        toast.error(resultado.error ?? 'No se pudo registrar')
      }
    } finally {
      setEnviando(false)
    }
  }

  if (servicios.length === 0) {
    return (
      <div className="rounded-md border p-12 text-center">
        <p className="text-muted-foreground">No hay servicios registrados.</p>
      </div>
    )
  }

  const esIngreso = registrando?.pata === 'INGRESO'
  const monto = registrando
    ? esIngreso
      ? registrando.servicio.valorFacturado
      : registrando.servicio.valorEntregado
    : 0

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Fecha</TableHead>
              <TableHead>Servicio</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead className="text-right">Facturado</TableHead>
              <TableHead className="text-right">Entregado</TableHead>
              <TableHead className="text-right">Margen</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-[180px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {servicios.map((servicio) => {
              const badge = BADGE_ESTADO[servicio.estado]

              return (
                <TableRow key={servicio.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatearFecha(servicio.fecha)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {servicio.tipoServicio.nombre}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {servicio.cliente.nombre}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {servicio.proveedor.nombre}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearMonto(servicio.valorFacturado)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatearMonto(servicio.valorEntregado)}
                  </TableCell>
                  {/* Margen cero es lo NORMAL en mensajería: se entrega el
                      100%. Lo que importa vigilar es el estado, no esto. */}
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatearMonto(servicio.margen)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badge.variant}>{badge.texto}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {!servicio.movimientoIngresoId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setRegistrando({ servicio, pata: 'INGRESO' })
                          }
                        >
                          <ArrowDownCircle className="mr-1 h-3.5 w-3.5" />
                          Cobro
                        </Button>
                      )}
                      {!servicio.movimientoEgresoId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setRegistrando({ servicio, pata: 'EGRESO' })
                          }
                        >
                          <ArrowUpCircle className="mr-1 h-3.5 w-3.5" />
                          Entrega
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={registrando !== null}
        onOpenChange={(abierto) => {
          if (!abierto) {
            setRegistrando(null)
            setBolsilloId('')
          }
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {esIngreso ? 'Registrar cobro' : 'Registrar entrega'}
            </DialogTitle>
            <DialogDescription>
              {esIngreso
                ? 'Entra la plata que paga el cliente.'
                : 'Sale la plata que se le entrega al tercero.'}{' '}
              El monto lo define el servicio, no se digita acá.
            </DialogDescription>
          </DialogHeader>

          {registrando && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium">
                {registrando.servicio.tipoServicio.nombre} ·{' '}
                {formatearMonto(monto)}
              </p>
              <p className="text-muted-foreground">
                {esIngreso
                  ? registrando.servicio.cliente.nombre
                  : registrando.servicio.proveedor.nombre}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>{esIngreso ? 'Entra a' : 'Sale de'}</Label>
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

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setRegistrando(null)}
              disabled={enviando}
            >
              Cancelar
            </Button>
            <Button onClick={confirmar} disabled={enviando || !bolsilloId}>
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
