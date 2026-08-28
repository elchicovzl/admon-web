'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Check } from 'lucide-react'

import { importarPagosComoEgresos } from '@/lib/actions/control.actions'
import type {
  PagosDelPeriodo,
  BolsilloListItem,
  CategoriaListItem,
} from '@/lib/types/control.types'
import { formatearMonto } from '@/lib/utils/control-format'
import { ETIQUETA_GRUPO } from './etiquetas'
import { useImportarPorTandas, BarraDeProgreso } from './importar-por-tandas'

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
import { SearchableSelect } from '@/components/ui/searchable-select'
import { cn } from '@/lib/utils'

interface Props {
  datos: PagosDelPeriodo
  bolsillos: BolsilloListItem[]
  categorias: CategoriaListItem[]
}

export function PagosClient({ datos, bolsillos, categorias }: Props) {
  const pendientes = datos.pagos.filter((p) => !p.yaRegistrado)

  const [seleccion, setSeleccion] = useState<Set<string>>(
    () => new Set(pendientes.map((p) => p.paymentId))
  )
  const [bolsilloId, setBolsilloId] = useState('')

  /**
   * La categoría es OPCIONAL: lo único que hay que decidir para importar es de
   * qué cuenta salió la plata. Lo que se deje en blanco se deriva del concepto
   * contable que ya trae Alegra —"Ingresos recibidos para terceros" queda como
   * categoría propia, que es lo único que importaba poder distinguir—.
   *
   * Elegirla igual sigue sirviendo: además de mandar sobre el concepto, la
   * decisión queda aprendida para los pagos siguientes con ese mismo concepto.
   */
  const [categoriaPorPago, setCategoriaPorPago] = useState<Record<string, string>>({})
  /** Se aplica a los que todavía no tienen una elegida, no pisa lo ya decidido. */
  const [categoriaMasiva, setCategoriaMasiva] = useState('')

  const { progreso, enviando, importar: correrTandas } = useImportarPorTandas((ids) =>
    importarPagosComoEgresos({
      periodo: datos.periodo,
      bolsilloId,
      pagos: ids.map((paymentId) => ({
        paymentId,
        categoriaId: categoriaPorPago[paymentId] || undefined,
      })),
    })
  )

  const elegidos = pendientes.filter((p) => seleccion.has(p.paymentId))
  const totalElegido = elegidos.reduce((a, p) => a + p.monto, 0)
  // No bloquea la importación: solo cuenta cuántos van a salir del concepto
  // en vez de una elección explícita.
  const derivados = elegidos.filter(
    (p) => !categoriaPorPago[p.paymentId] && p.conceptos.length > 0
  )
  const sinConcepto = elegidos.filter(
    (p) => !categoriaPorPago[p.paymentId] && p.conceptos.length === 0
  )

  const nombrePorCategoria = new Map(categorias.map((c) => [c.id, c.nombre]))

  /** Qué categoría va a quedar si no se elige ninguna. Solo para mostrar. */
  function categoriaAutomatica(p: (typeof datos.pagos)[number]): string {
    if (p.categoriaSugeridaId) {
      return `${nombrePorCategoria.get(p.categoriaSugeridaId) ?? 'la mapeada'} (aprendida)`
    }
    if (p.conceptos[0]) return `${p.conceptos[0]} (del concepto)`
    return 'Otro'
  }

  const opcionesCategoria = categorias
    .filter((c) => c.isActive)
    .map((c) => ({
      value: c.id,
      label: `${c.nombre} · ${ETIQUETA_GRUPO[c.grupo] ?? c.grupo}`,
    }))

  function alternar(id: string) {
    setSeleccion((actual) => {
      const copia = new Set(actual)
      if (copia.has(id)) copia.delete(id)
      else copia.add(id)
      return copia
    })
  }

  async function importar() {
    const { completados, error, resumen } = await correrTandas(
      elegidos.map((p) => p.paymentId)
    )

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
          ? `${error}. Alcanzaron a registrarse ${resumen.creados}; volvé a intentar con los que quedaron.`
          : error
      )
      return
    }

    toast.success(
      `${resumen.creados} egreso${resumen.creados === 1 ? '' : 's'} registrado${
        resumen.creados === 1 ? '' : 's'
      }`
    )
  }

  if (datos.pagos.length === 0) {
    return (
      <div className="rounded-md border p-12 text-center">
        <p className="text-muted-foreground">
          No hay pagos de Alegra en este periodo.
        </p>
      </div>
    )
  }

  const todosMarcados =
    pendientes.length > 0 && pendientes.every((p) => seleccion.has(p.paymentId))

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-md border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-56">
            <SearchableSelect
              options={bolsillos.map((b) => ({ value: b.id, label: b.nombre }))}
              value={bolsilloId || null}
              onValueChange={(v) => setBolsilloId(v ?? '')}
              placeholder="¿De qué bolsillo sale?"
              searchPlaceholder="Buscar bolsillo…"
              disabled={enviando}
            />
          </div>

          {/* Rellena los que todavía no tienen categoría. No pisa lo ya
              decidido a mano: sería tirar el trabajo de clasificar. */}
          <div className="w-72">
            <SearchableSelect
              options={opcionesCategoria}
              value={categoriaMasiva || null}
              onValueChange={(v) => {
                const categoriaId = v ?? ''
                setCategoriaMasiva(categoriaId)
                if (!categoriaId) return
                setCategoriaPorPago((actual) => {
                  const copia = { ...actual }
                  for (const p of elegidos) {
                    if (!copia[p.paymentId]) copia[p.paymentId] = categoriaId
                  }
                  return copia
                })
              }}
              placeholder="Forzar una categoría (opcional)…"
              searchPlaceholder="Buscar categoría…"
              disabled={enviando}
            />
          </div>

          {/* Lo único obligatorio es la cuenta. */}
          <Button
            disabled={enviando || elegidos.length === 0 || !bolsilloId}
            onClick={importar}
          >
            {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar como egresos
          </Button>
        </div>

        <p className="text-sm">
          {elegidos.length === 0 ? (
            <span className="text-muted-foreground">No hay pagos seleccionados</span>
          ) : (
            <>
              <span className="font-medium">{elegidos.length}</span> pago
              {elegidos.length === 1 ? '' : 's'} por{' '}
              <span className="font-medium tabular-nums">
                {formatearMonto(totalElegido)}
              </span>
              {derivados.length > 0 && (
                <span className="text-muted-foreground">
                  {' '}
                  · {derivados.length} con la categoría del concepto de Alegra
                </span>
              )}
              {sinConcepto.length > 0 && (
                <span className="text-muted-foreground">
                  {' '}
                  · {sinConcepto.length} sin concepto, entran en &quot;Otro&quot;
                </span>
              )}
            </>
          )}
        </p>
      </div>

      <BarraDeProgreso progreso={progreso} />

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={todosMarcados}
                  disabled={pendientes.length === 0 || enviando}
                  aria-label="Marcar todos"
                  onCheckedChange={(v) =>
                    setSeleccion(
                      v ? new Set(pendientes.map((p) => p.paymentId)) : new Set()
                    )
                  }
                />
              </TableHead>
              <TableHead className="w-[110px]">Fecha</TableHead>
              <TableHead className="w-[80px]">Nº</TableHead>
              <TableHead>Beneficiario</TableHead>
              <TableHead>Concepto en Alegra</TableHead>
              <TableHead className="w-72">Categoría</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {datos.pagos.map((p) => (
              <TableRow
                key={p.paymentId}
                className={cn(p.yaRegistrado && 'opacity-50')}
              >
                <TableCell>
                  {p.yaRegistrado ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Checkbox
                      checked={seleccion.has(p.paymentId)}
                      disabled={enviando}
                      aria-label={`Pago ${p.numero}`}
                      onCheckedChange={() => alternar(p.paymentId)}
                    />
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">{p.fecha}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {p.numero}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{p.beneficiario}</div>
                  {p.cuenta && (
                    <div className="text-xs text-muted-foreground">{p.cuenta}</div>
                  )}
                </TableCell>

                {/* Por qué se pagó, según Alegra. Es de donde sale la
                    categoría del libro. */}
                <TableCell className="text-sm">
                  {p.conceptos.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {p.conceptos.map((c) => (
                        <Badge key={c} variant="outline" className="font-normal">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span
                      className="text-muted-foreground"
                      title="El pago salda una factura de compra de otro mes: su concepto no vino en esta consulta."
                    >
                      Sin concepto
                    </span>
                  )}
                  {p.aplicadoA && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {p.aplicadoA}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {p.yaRegistrado ? (
                    <Badge variant="secondary">Registrado</Badge>
                  ) : (
                    <SearchableSelect
                      options={opcionesCategoria}
                      value={categoriaPorPago[p.paymentId] ?? null}
                      onValueChange={(v) =>
                        setCategoriaPorPago((actual) => ({
                          ...actual,
                          [p.paymentId]: v ?? '',
                        }))
                      }
                      placeholder={categoriaAutomatica(p)}
                      searchPlaceholder="Buscar categoría…"
                      disabled={enviando}
                    />
                  )}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatearMonto(p.monto)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
