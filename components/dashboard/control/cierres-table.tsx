'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Lock, ClipboardCheck } from 'lucide-react'

import { registrarConteo, cerrarPeriodo } from '@/lib/actions/control.actions'
import type { CierreMensualView } from '@/lib/types/control.types'
import { Monto } from './monto'
import {
  formatearMonto,
  formatearDiferencia,
  formatearPeriodo,
} from '@/lib/utils/control-format'

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  periodo: string
  cierres: CierreMensualView[]
}

export function CierresTable({ periodo, cierres }: Props) {
  const [contando, setContando] = useState<CierreMensualView | null>(null)
  const [cerrando, setCerrando] = useState<CierreMensualView | null>(null)
  const [enviando, setEnviando] = useState(false)

  const [contado, setContado] = useState('')
  const [justificacion, setJustificacion] = useState('')

  function cerrarDialogos() {
    setContando(null)
    setCerrando(null)
    setContado('')
    setJustificacion('')
  }

  /**
   * Se calcula en vivo mientras el operador escribe el conteo, para que vea la
   * diferencia ANTES de confirmar. Si la ve recién en el error, ya escribió el
   * número dos veces.
   */
  const diferenciaPrevia =
    contando && contado !== ''
      ? Number(contado) - contando.saldoFinalCalculado
      : null

  async function confirmarConteo() {
    if (!contando) return
    setEnviando(true)
    try {
      const resultado = await registrarConteo({
        periodo,
        bolsilloId: contando.bolsillo.id,
        saldoFinalReal: contado === '' ? null : Number(contado),
        justificacion: justificacion.trim() || null,
      })

      if (resultado.success) {
        toast.success(resultado.message ?? 'Conteo registrado')
        cerrarDialogos()
      } else {
        toast.error(resultado.error ?? 'No se pudo registrar')
      }
    } finally {
      setEnviando(false)
    }
  }

  async function confirmarCierre() {
    if (!cerrando) return
    setEnviando(true)
    try {
      const resultado = await cerrarPeriodo({
        periodo,
        bolsilloId: cerrando.bolsillo.id,
      })

      if (resultado.success) {
        toast.success(resultado.message ?? 'Periodo cerrado')
        cerrarDialogos()
      } else {
        toast.error(resultado.error ?? 'No se pudo cerrar')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bolsillo</TableHead>
              <TableHead className="text-right">Inicial</TableHead>
              <TableHead className="text-right">Movimientos</TableHead>
              <TableHead className="text-right">Calculado</TableHead>
              <TableHead className="text-right">Contado</TableHead>
              <TableHead className="text-right">Diferencia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-[200px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cierres.map((cierre) => {
              const descuadrado =
                cierre.diferencia !== null && cierre.diferencia !== 0
              const bloqueado = descuadrado && !cierre.justificacion

              return (
                <TableRow key={cierre.bolsillo.id}>
                  <TableCell className="font-medium">
                    {cierre.bolsillo.nombre}
                    {cierre.esAperturaInicial && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Apertura
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Monto valor={cierre.saldoInicial} tenue />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {cierre.cantidadMovimientos}
                  </TableCell>
                  {/* Nunca se digita: sale de los movimientos. */}
                  <TableCell className="text-right font-medium">
                    <Monto valor={cierre.saldoFinalCalculado} />
                  </TableCell>
                  <TableCell className="text-right">
                    {cierre.saldoFinalReal === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Monto valor={cierre.saldoFinalReal} tenue />
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {cierre.diferencia === null ? (
                      <span className="text-muted-foreground">Sin contar</span>
                    ) : cierre.diferencia === 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Cuadra
                      </span>
                    ) : (
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {formatearDiferencia(cierre.diferencia)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {cierre.cerrado ? (
                      <Badge variant="secondary">
                        <Lock className="mr-1 h-3 w-3" />
                        Cerrado
                      </Badge>
                    ) : bloqueado ? (
                      <Badge variant="destructive">Sin justificar</Badge>
                    ) : (
                      <Badge variant="outline">Abierto</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {!cierre.cerrado && (
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setContando(cierre)
                            setContado(
                              cierre.saldoFinalReal === null
                                ? ''
                                : String(cierre.saldoFinalReal)
                            )
                            setJustificacion(cierre.justificacion ?? '')
                          }}
                        >
                          <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
                          Contar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={bloqueado}
                          onClick={() => setCerrando(cierre)}
                        >
                          <Lock className="mr-1 h-3.5 w-3.5" />
                          Cerrar
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Conteo */}
      <Dialog open={contando !== null} onOpenChange={(o) => !o && cerrarDialogos()}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Registrar conteo — {contando?.bolsillo.nombre}</DialogTitle>
            <DialogDescription>
              Lo que contaste físicamente o dice el extracto. Sirve para
              comparar contra lo calculado, no para reemplazarlo.
            </DialogDescription>
          </DialogHeader>

          {contando && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Calculado por el sistema</span>
                <Monto valor={contando.saldoFinalCalculado} className="font-medium" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="conteo">Saldo contado</Label>
            <Input
              id="conteo"
              type="number"
              min={0}
              step={1}
              value={contado}
              onChange={(e) => setContado(e.target.value)}
              disabled={enviando}
            />
          </div>

          {diferenciaPrevia !== null && diferenciaPrevia !== 0 && (
            <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-destructive">
                Diferencia de {formatearDiferencia(diferenciaPrevia)}
              </p>
              <Label htmlFor="justificacion">Justificación (obligatoria)</Label>
              <Textarea
                id="justificacion"
                rows={3}
                placeholder="Faltante de caja chica, revisado con Ivone"
                value={justificacion}
                onChange={(e) => setJustificacion(e.target.value)}
                disabled={enviando}
              />
              <p className="text-xs text-muted-foreground">
                Un descuadre sin explicación es exactamente lo que hacía el
                Excel, y por eso ADMON perdió 1.932.660 sin dejar rastro.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cerrarDialogos} disabled={enviando}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarConteo}
              disabled={
                enviando ||
                (diferenciaPrevia !== null &&
                  diferenciaPrevia !== 0 &&
                  justificacion.trim().length === 0)
              }
            >
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar conteo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cierre */}
      <Dialog open={cerrando !== null} onOpenChange={(o) => !o && cerrarDialogos()}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Cerrar {formatearPeriodo(periodo)}</DialogTitle>
            <DialogDescription>
              Una vez cerrado, ese bolsillo no admite movimientos con fecha en
              este periodo. Y la apertura del mes siguiente queda fijada en el
              saldo de cierre — que es la invariante que el Excel no tenía.
            </DialogDescription>
          </DialogHeader>

          {cerrando && (
            <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bolsillo</span>
                <span className="font-medium">{cerrando.bolsillo.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo de cierre</span>
                <Monto valor={cerrando.saldoFinalCalculado} className="font-medium" />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Movimientos</span>
                <span className="tabular-nums">{cerrando.cantidadMovimientos}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cerrarDialogos} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={confirmarCierre} disabled={enviando}>
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cerrar periodo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
