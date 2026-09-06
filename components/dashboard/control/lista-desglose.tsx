'use client'

/**
 * Una de las cuatro listas del desglose del mes, con sus filas abribles.
 *
 * El detalle se pide RECIÉN AL ABRIR una fila. Traerlo todo con la página
 * significaría cargar los movimientos de las cuarenta y pico de filas del
 * panel para que se miren una o dos.
 */

import { useState } from 'react'
import { Loader2, ChevronRight } from 'lucide-react'

import { getDetalleDelCorte } from '@/lib/actions/control.actions'
import type { FilaDesglose, CorteDelDesglose, ItemDelCorte } from '@/lib/types/control.types'
import { formatearMonto, formatearFecha } from '@/lib/utils/control-format'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface Props {
  titulo: string
  descripcion: string
  filas: FilaDesglose[]
  vacio: string
  corte: CorteDelDesglose
  periodo: string
}

export function ListaDesglose({
  titulo,
  descripcion,
  filas,
  vacio,
  corte,
  periodo,
}: Props) {
  const [abierta, setAbierta] = useState<FilaDesglose | null>(null)
  const [items, setItems] = useState<ItemDelCorte[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const total = filas.reduce((a, f) => a + f.monto, 0)
  const mayor = Math.max(...filas.map((f) => f.monto), 1)

  async function abrir(fila: FilaDesglose) {
    setAbierta(fila)
    setItems(null)
    setError(null)

    const r = await getDetalleDelCorte({ periodo, corte, clave: fila.nombre })
    if (r.success && r.data) setItems(r.data.items)
    else setError(r.error ?? 'No se pudo cargar el detalle')
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-baseline justify-between gap-2">
            <CardTitle className="text-sm font-medium">{titulo}</CardTitle>
            <span className="text-sm font-bold tabular-nums">{formatearMonto(total)}</span>
          </div>
          <CardDescription className="text-xs">{descripcion}</CardDescription>
        </CardHeader>
        <CardContent>
          {filas.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{vacio}</p>
          ) : (
            <ul className="space-y-2">
              {filas.map((f) => (
                <li key={f.nombre}>
                  <button
                    type="button"
                    onClick={() => abrir(f)}
                    className="group w-full space-y-1 rounded-sm px-1 py-0.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="truncate" title={f.nombre}>
                          {f.nombre}
                        </span>
                        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </span>
                      <span className="shrink-0 tabular-nums">{formatearMonto(f.monto)}</span>
                    </div>
                    {/* La barra es para comparar de un vistazo, no para leer el
                        valor: el número ya está al lado. */}
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-primary"
                        style={{ width: `${Math.round((f.monto / mayor) * 100)}%` }}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Sheet open={abierta !== null} onOpenChange={(o) => !o && setAbierta(null)}>
        <SheetContent className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{abierta?.nombre}</SheetTitle>
            <SheetDescription>
              {abierta &&
                `${formatearMonto(abierta.monto)} en ${abierta.movs} movimiento${
                  abierta.movs === 1 ? '' : 's'
                } · ${titulo}`}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 overflow-y-auto px-4 pb-6">
            {error && (
              <p className="rounded-md border border-destructive/50 p-4 text-sm text-destructive">
                {error}
              </p>
            )}

            {!error && items === null && (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando los movimientos…
              </div>
            )}

            {items !== null && items.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No se encontraron movimientos.
              </p>
            )}

            {items !== null && items.length > 0 && (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Fecha</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Aporta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((i) => (
                      <TableRow key={`${i.movimientoId}-${i.aporta}`}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatearFecha(i.fecha)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{i.concepto}</div>
                          <div className="text-xs text-muted-foreground">
                            {[i.categoria, i.bolsillo, i.contraparte]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium tabular-nums">
                            {formatearMonto(i.aporta)}
                          </div>
                          {/* Solo cuando el movimiento aporta una PARTE: un
                              cobro desglosado en varios servicios, o uno con
                              IVA. Sin esto, el número de al lado no cuadra
                              contra el movimiento y parece un error. */}
                          {i.aporta !== i.monto && (
                            <Badge variant="outline" className="mt-1 font-normal">
                              de {formatearMonto(i.monto)}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
