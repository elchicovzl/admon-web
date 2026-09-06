'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Check, ExternalLink } from 'lucide-react'
import Link from 'next/link'

import { importarFacturasComoIngresos } from '@/lib/actions/control.actions'
import type { FacturasDelPeriodo, BolsilloListItem } from '@/lib/types/control.types'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useImportarPorTandas, BarraDeProgreso } from './importar-por-tandas'

interface Props {
  datos: FacturasDelPeriodo
  bolsillos: BolsilloListItem[]
}

export function FacturasClient({ datos, bolsillos }: Props) {
  /**
   * Solo se pueden registrar las que cobraron algo. Una factura emitida y sin
   * pagar no movió plata en ninguna caja, así que no tiene ingreso que
   * registrar por más que exista el documento.
   */
  const registrables = datos.facturas.filter((f) => !f.yaRegistrada && f.totalPagado > 0)

  const [seleccion, setSeleccion] = useState<Set<string>>(
    () => new Set(registrables.map((f) => f.invoiceId))
  )
  // ADMON viene preseleccionado: el negocio confirmó que las facturas entran
  // ahí. Se sigue pudiendo cambiar — el selector queda, pero deja de ser un
  // paso obligatorio en el caso normal.
  const [bolsilloId, setBolsilloId] = useState(
    () => bolsillos.find((b) => b.nombre === 'ADMON')?.id ?? ''
  )
  const { progreso, enviando, importar: correrTandas } = useImportarPorTandas(
    (invoiceIds) =>
      importarFacturasComoIngresos({ periodo: datos.periodo, invoiceIds, bolsilloId })
  )

  const elegidas = registrables.filter((f) => seleccion.has(f.invoiceId))
  const totalElegido = elegidas.reduce((a, f) => a + f.totalPagado, 0)

  async function importar() {
    const { completados, error, resumen } = await correrTandas(
      elegidas.map((f) => f.invoiceId)
    )

    // Solo las procesadas: si una tanda falló, las siguientes tienen que
    // quedar marcadas para reintentar sin volver a elegirlas.
    if (completados.length > 0) {
      setSeleccion((actual) => {
        const copia = new Set(actual)
        for (const id of completados) copia.delete(id)
        return copia
      })
    }

    if (error) {
      toast.error(
        resumen.creados > 0
          ? `${error}. Alcanzaron a registrarse ${resumen.creados}; volvé a intentar con las que quedaron.`
          : error
      )
      return
    }

    toast.success(
      `${resumen.creados} ingreso${resumen.creados === 1 ? '' : 's'} registrado${
        resumen.creados === 1 ? '' : 's'
      }` +
        (resumen.sinDesglose > 0
          ? `, ${resumen.sinDesglose} sin desglose por servicio`
          : '')
    )
  }

  if (datos.facturas.length === 0) {
    return (
      <div className="rounded-md border p-12 text-center">
        <p className="text-muted-foreground">
          No hay facturas de venta de Alegra en este periodo.
        </p>
      </div>
    )
  }

  const todasMarcadas =
    registrables.length > 0 && registrables.every((f) => seleccion.has(f.invoiceId))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">
            {elegidas.length === 0 ? (
              <span className="text-muted-foreground">Nada seleccionado</span>
            ) : (
              <>
                <span className="font-medium">{elegidas.length}</span> factura
                {elegidas.length === 1 ? '' : 's'} por{' '}
                <span className="font-medium tabular-nums">
                  {formatearMonto(totalElegido)}
                </span>
              </>
            )}
          </p>
          {/* El bolsillo se pregunta, al revés que en las cotizaciones: para
              esas el negocio confirmó que todas entran a IVONE; para el dinero
              "por arriba" no hay respuesta confirmada, y meter plata en la caja
              equivocada descuadra dos bolsillos de una vez. */}
          <Select value={bolsilloId} onValueChange={setBolsilloId} disabled={enviando}>
            <SelectTrigger className="h-9 w-[190px]">
              <SelectValue placeholder="¿A qué bolsillo entra?" />
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
        <Button
          disabled={enviando || elegidas.length === 0 || !bolsilloId}
          onClick={importar}
        >
          {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Registrar como ingresos
        </Button>
      </div>

      <BarraDeProgreso progreso={progreso} />

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={todasMarcadas}
                  disabled={registrables.length === 0}
                  aria-label="Seleccionar todas"
                  onCheckedChange={(v) =>
                    setSeleccion(
                      v ? new Set(registrables.map((f) => f.invoiceId)) : new Set()
                    )
                  }
                />
              </TableHead>
              <TableHead className="w-[110px]">Fecha</TableHead>
              <TableHead className="w-[110px]">Nº</TableHead>
              <TableHead>Servicio / cliente</TableHead>
              <TableHead className="text-right">Facturado</TableHead>
              <TableHead className="text-right">Cobrado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="w-[140px]">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {datos.facturas.map((f) => {
              const sinCobrar = f.totalPagado === 0
              return (
                <TableRow
                  key={f.invoiceId}
                  className={cn((f.yaRegistrada || sinCobrar) && 'opacity-60')}
                >
                  <TableCell>
                    <Checkbox
                      checked={seleccion.has(f.invoiceId)}
                      disabled={f.yaRegistrada || sinCobrar || enviando}
                      aria-label={`Seleccionar factura ${f.numero}`}
                      onCheckedChange={() =>
                        setSeleccion((a) => {
                          const c = new Set(a)
                          c.has(f.invoiceId) ? c.delete(f.invoiceId) : c.add(f.invoiceId)
                          return c
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {f.fecha.slice(0, 10)}
                  </TableCell>
                  <TableCell className="text-sm">
                    <Link
                      href={`/dashboard/finances/invoices/${f.invoiceId}`}
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {f.numero}
                      <ExternalLink className="h-3 w-3 opacity-50" />
                    </Link>
                  </TableCell>
                  <TableCell>
                    {/* El servicio va primero: "Administración", "Recaudo para
                        Terceros", "Independiente 03". Es lo que después
                        permite preguntar cuánto se recaudó por cada uno. */}
                    <p className="font-medium">{f.descripcion ?? f.cliente}</p>
                    {f.descripcion && (
                      <p className="text-xs text-muted-foreground">{f.cliente}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Monto valor={f.total} tenue />
                  </TableCell>
                  {/* Lo cobrado es lo que entra al libro, no lo facturado. */}
                  <TableCell className="text-right font-medium">
                    <Monto valor={f.totalPagado} />
                  </TableCell>
                  <TableCell className="text-right">
                    {f.saldo === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Monto valor={f.saldo} tenue />
                    )}
                  </TableCell>
                  <TableCell>
                    {f.yaRegistrada ? (
                      <Badge variant="secondary" className="gap-1">
                        <Check className="h-3 w-3" />
                        Ya registrada
                      </Badge>
                    ) : sinCobrar ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        Sin cobrar
                      </Badge>
                    ) : (
                      <Badge variant="outline">Pendiente</Badge>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
