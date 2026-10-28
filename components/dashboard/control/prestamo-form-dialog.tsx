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
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'

import { createPrestamo } from '@/lib/actions/control.actions'
import type { BolsilloListItem, ManagerPrestamoItem } from '@/lib/types/control.types'
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
  /** Solo managers activos: a nadie más se le presta. */
  managers: ManagerPrestamoItem[]
}

const VACIO = {
  userId: '',
  fechaDesembolso: hoyComoFechaCalendario(),
  montoOriginal: '',
  concepto: '',
  bolsilloOrigenId: '',
  notas: '',
}

export function PrestamoFormDialog({ bolsillos, managers }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [form, setForm] = useState(VACIO)

  const monto = Number(form.montoOriginal)
  const puedeGuardar =
    Boolean(form.userId) &&
    Boolean(form.bolsilloOrigenId) &&
    form.concepto.trim().length >= 3 &&
    monto > 0

  async function guardar() {
    setEnviando(true)
    try {
      const r = await createPrestamo({
        userId: form.userId,
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
            <Label>A quién se le presta</Label>
            <SearchableSelect
              options={managers.map((m) => ({ value: m.id, label: m.nombre }))}
              value={form.userId || null}
              onValueChange={(v) => setForm((f) => ({ ...f, userId: v ?? '' }))}
              placeholder="Buscá o seleccioná un manager…"
              searchPlaceholder="Escribí para filtrar…"
              disabled={enviando}
            />
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
              {managers.find((m) => m.id === form.userId)?.nombre}.
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
