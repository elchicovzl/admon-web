'use client'

/**
 * Alta de un préstamo.
 *
 * No pide saldo ni estado: los dos se derivan de los movimientos. Lo único que
 * se digita es el hecho —a quién, cuánto, de qué bolsillo salió y por qué—,
 * porque guardar un saldo es cómo se desincroniza del libro. En el Excel el
 * estado era texto libre con 178 variantes y no había forma de saber cuánto
 * debía nadie sin leer 240 filas.
 */

import { useState } from 'react'
import { TipoContraparte } from '@prisma/client'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'

import { createPrestamo, createContraparte } from '@/lib/actions/control.actions'
import type { BolsilloListItem, ContraparteListItem } from '@/lib/types/control.types'
import { formatearMonto, hoyComoFechaCalendario } from '@/lib/utils/control-format'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface Props {
  bolsillos: BolsilloListItem[]
  contrapartes: ContraparteListItem[]
}

const VACIO = {
  contraparteId: '',
  fechaDesembolso: hoyComoFechaCalendario(),
  montoOriginal: '',
  concepto: '',
  bolsilloOrigenId: '',
  notas: '',
}

export function PrestamoFormDialog({ bolsillos, contrapartes }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [form, setForm] = useState(VACIO)

  /**
   * Las contrapartes se guardan en estado local: se pueden crear sin salir de
   * acá y tienen que aparecer en el selector al instante.
   */
  const [lista, setLista] = useState(contrapartes)
  const [creando, setCreando] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [guardandoContraparte, setGuardandoContraparte] = useState(false)

  const monto = Number(form.montoOriginal)
  const puedeGuardar =
    Boolean(form.contraparteId) &&
    Boolean(form.bolsilloOrigenId) &&
    form.concepto.trim().length >= 3 &&
    monto > 0

  async function crearContraparte() {
    setGuardandoContraparte(true)
    try {
      const r = await createContraparte({ nombre: nombreNuevo, tipo: TipoContraparte.OTRO })
      if (r.success && r.data) {
        setLista((a) => [...a, r.data!])
        setForm((f) => ({ ...f, contraparteId: r.data!.id }))
        setNombreNuevo('')
        setCreando(false)
        toast.success(r.message ?? 'Contraparte creada')
      } else {
        toast.error(r.error ?? 'No se pudo crear')
      }
    } finally {
      setGuardandoContraparte(false)
    }
  }

  async function guardar() {
    setEnviando(true)
    try {
      const r = await createPrestamo({
        contraparteId: form.contraparteId,
        fechaDesembolso: form.fechaDesembolso,
        montoOriginal: monto,
        concepto: form.concepto,
        bolsilloOrigenId: form.bolsilloOrigenId,
        notas: form.notas.trim() || null,
      })

      if (r.success) {
        toast.success(r.message ?? 'Préstamo registrado')
        setForm({ ...VACIO, fechaDesembolso: form.fechaDesembolso })
        setAbierto(false)
      } else {
        toast.error(r.error ?? 'No se pudo registrar')
      }
    } catch (error) {
      console.error('[control] createPrestamo:', error)
      toast.error('Error inesperado al registrar el préstamo')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Registrar préstamo
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Registrar préstamo</DialogTitle>
          <DialogDescription>
            Se crea el préstamo y su movimiento de desembolso, los dos juntos. El
            saldo y el estado no se digitan: salen de los movimientos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>A quién se le presta</Label>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                disabled={enviando}
                onClick={() => setCreando((v) => !v)}
              >
                {creando ? 'Cancelar' : '+ Nueva contraparte'}
              </Button>
            </div>

            <SearchableSelect
              options={lista
                .filter((c) => c.isActive)
                .map((c) => ({ value: c.id, label: c.nombre }))}
              value={form.contraparteId || null}
              onValueChange={(v) => setForm((f) => ({ ...f, contraparteId: v ?? '' }))}
              placeholder="Buscá o seleccioná…"
              searchPlaceholder="Escribí para filtrar…"
              disabled={enviando}
            />

            {creando && (
              <div className="flex gap-2 rounded-md border bg-muted/40 p-3">
                <Input
                  placeholder="Nombre"
                  value={nombreNuevo}
                  onChange={(e) => setNombreNuevo(e.target.value)}
                  disabled={guardandoContraparte}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={guardandoContraparte || nombreNuevo.trim().length < 2}
                  onClick={crearContraparte}
                >
                  {guardandoContraparte && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Crear
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prestamo-fecha">Fecha del desembolso</Label>
              <Input
                id="prestamo-fecha"
                type="date"
                value={form.fechaDesembolso}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fechaDesembolso: e.target.value }))
                }
                disabled={enviando}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prestamo-monto">Monto</Label>
              <Input
                id="prestamo-monto"
                type="number"
                min={1}
                step={1}
                value={form.montoOriginal}
                onChange={(e) =>
                  setForm((f) => ({ ...f, montoOriginal: e.target.value }))
                }
                disabled={enviando}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>De qué bolsillo sale</Label>
            <SearchableSelect
              options={bolsillos
                .filter((b) => b.isActive)
                .map((b) => ({ value: b.id, label: b.nombre }))}
              value={form.bolsilloOrigenId || null}
              onValueChange={(v) => setForm((f) => ({ ...f, bolsilloOrigenId: v ?? '' }))}
              placeholder="Seleccioná el bolsillo…"
              searchPlaceholder="Buscar bolsillo…"
              disabled={enviando}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prestamo-concepto">Concepto</Label>
            <Input
              id="prestamo-concepto"
              placeholder="Por qué se prestó"
              value={form.concepto}
              onChange={(e) => setForm((f) => ({ ...f, concepto: e.target.value }))}
              disabled={enviando}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prestamo-notas">Notas (opcional)</Label>
            <Textarea
              id="prestamo-notas"
              rows={2}
              value={form.notas}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
              disabled={enviando}
            />
          </div>

          {/* Lo que va a pasar, dicho antes de apretar: el desembolso mueve
              plata de verdad y conviene verlo escrito. */}
          {puedeGuardar && (
            <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              Sale <strong className="text-foreground">{formatearMonto(monto)}</strong> de{' '}
              {bolsillos.find((b) => b.id === form.bolsilloOrigenId)?.nombre} para{' '}
              {lista.find((c) => c.id === form.contraparteId)?.nombre}.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setAbierto(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={enviando || !puedeGuardar}>
            {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar préstamo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
