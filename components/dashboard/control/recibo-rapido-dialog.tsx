'use client'

/**
 * Quick receipt: registers an INCOME and issues its payment receipt in one
 * step, with only the fields a receipt needs. It goes through the same
 * `createMovimiento` action and schema as the full form, so the rules
 * (closed periods, lines adding up to the amount, client counterparty) are
 * the same.
 */

import { useState } from 'react'
import { useFieldArray, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { TipoMovimiento } from '@prisma/client'
import { toast } from 'sonner'
import { Loader2, Receipt, Trash2 } from 'lucide-react'

import { createMovimiento } from '@/lib/actions/control.actions'
import {
  createMovimientoSchema,
  type CreateMovimientoInput,
} from '@/lib/validations/control.schema'
import type {
  BolsilloListItem,
  CategoriaListItem,
  ClienteReciboItem,
  ServicioAlegraListItem,
} from '@/lib/types/control.types'
import { formatearMonto, hoyComoFechaCalendario } from '@/lib/utils/control-format'
import {
  categoriasDeCobro,
  etiquetaClienteRecibo,
  normalizarEntradaMovimiento,
  rutaPdfRecibo,
  sumaDeLineas,
} from '@/lib/utils/control-recibo'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
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
import { SearchableSelect } from '@/components/ui/searchable-select'
import { MontoInput } from './monto-input'
import { ETIQUETA_GRUPO } from './etiquetas'

type LineaServicio = NonNullable<CreateMovimientoInput['servicios']>[number]

/** Same empty line as the full form: no service and an empty amount field. */
const LINEA_VACIA = { servicioAlegraId: '', monto: undefined } as unknown as LineaServicio

const resolver: Resolver<CreateMovimientoInput> = (values, context, options) =>
  zodResolver(createMovimientoSchema)(normalizarEntradaMovimiento(values), context, options)

function valoresIniciales(
  fecha: string,
  bolsilloId: string,
  categoriaId: string
): Partial<CreateMovimientoInput> {
  return {
    fecha,
    tipo: TipoMovimiento.INGRESO,
    concepto: '',
    bolsilloId,
    bolsilloDestinoId: null,
    categoriaId,
    contraparteId: null,
    clientId: null,
    servicioAlegraId: null,
    servicios: [LINEA_VACIA],
    emitirRecibo: true,
    notas: null,
  }
}

interface Props {
  bolsillos: BolsilloListItem[]
  categorias: CategoriaListItem[]
  clientes: ClienteReciboItem[]
  serviciosAlegra: ServicioAlegraListItem[]
}

export function ReciboRapidoDialog({ bolsillos, categorias, clientes, serviciosAlegra }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const form = useForm<CreateMovimientoInput>({
    resolver,
    defaultValues: valoresIniciales(hoyComoFechaCalendario(), '', ''),
  })

  const lineas = useFieldArray({ control: form.control, name: 'servicios' })

  const monto = form.watch('monto')
  const sumaLineas = sumaDeLineas(form.watch('servicios') ?? [])
  const diferencia = monto === undefined ? 0 : sumaLineas - sumaDeLineas([{ monto }])

  const opcionesCategoria = categoriasDeCobro(categorias).map((c) => ({
    value: c.id,
    label: `${c.nombre} · ${ETIQUETA_GRUPO[c.grupo] ?? c.grupo}`,
  }))

  const opcionesCliente = clientes.map((c) => ({ value: c.id, label: etiquetaClienteRecibo(c) }))

  const opcionesServicio = serviciosAlegra
    .filter((s) => s.isActive)
    .map((s) => ({
      value: s.id,
      label: s.referencia ? `${s.referencia} · ${s.nombre}` : s.nombre,
    }))

  async function onSubmit(data: CreateMovimientoInput) {
    // The server validates this too; checking here avoids a round trip.
    if (data.servicios && sumaDeLineas(data.servicios) !== sumaDeLineas([{ monto: data.monto }])) {
      form.setError('servicios', {
        message: 'La suma de los servicios debe ser igual al monto del ingreso.',
      })
      return
    }

    setGuardando(true)
    try {
      const resultado = await createMovimiento({
        ...data,
        tipo: TipoMovimiento.INGRESO,
        emitirRecibo: true,
      })

      if (resultado.success) {
        const recibo = resultado.data?.recibo
        toast.success(resultado.message ?? 'Movimiento y recibo de pago registrados', {
          duration: 15000,
          action: recibo
            ? {
                label: 'Descargar recibo',
                onClick: () => window.open(rutaPdfRecibo(recibo.id), '_blank', 'noopener'),
              }
            : undefined,
        })
        // Date, pocket and category usually repeat across receipts in a row.
        form.reset(valoresIniciales(data.fecha, data.bolsilloId, data.categoriaId))
        setAbierto(false)
      } else {
        toast.error(resultado.error ?? 'No se pudo registrar el recibo')
      }
    } catch (error) {
      console.error('[control] recibo rápido:', error)
      toast.error('Error inesperado al registrar el recibo')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Receipt className="mr-2 h-4 w-4" />
          Recibo rápido
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recibo rápido</DialogTitle>
          <DialogDescription>
            Registra un ingreso y emite su recibo de pago a nombre del cliente.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fecha"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha</FormLabel>
                  <FormControl>
                    <Input type="date" disabled={guardando} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={opcionesCliente}
                      value={field.value ?? null}
                      onValueChange={(v) => field.onChange(v || null)}
                      placeholder="Seleccioná un cliente…"
                      searchPlaceholder="Buscar por nombre o documento…"
                      disabled={guardando}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Servicios</Label>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  disabled={guardando}
                  onClick={() => lineas.append(LINEA_VACIA)}
                >
                  + Agregar servicio
                </Button>
              </div>

              {serviciosAlegra.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  El catálogo está vacío. Sincronizalo en Catálogos → Servicios Alegra.
                </p>
              )}

              {lineas.fields.map((linea, indice) => (
                <div
                  key={linea.id}
                  className="grid grid-cols-[1fr_auto] items-start gap-2 sm:grid-cols-[1fr_160px_auto]"
                >
                  <FormField
                    control={form.control}
                    name={`servicios.${indice}.servicioAlegraId`}
                    render={({ field }) => (
                      <FormItem className="col-span-2 sm:col-span-1">
                        <FormControl>
                          <SearchableSelect
                            options={opcionesServicio}
                            value={field.value || null}
                            onValueChange={(v) => field.onChange(v ?? '')}
                            placeholder="Seleccioná un servicio…"
                            searchPlaceholder="Buscar servicio…"
                            disabled={guardando}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`servicios.${indice}.monto`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <MontoInput
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            disabled={guardando}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    disabled={guardando || lineas.fields.length === 1}
                    onClick={() => lineas.remove(indice)}
                  >
                    <span className="sr-only">Quitar servicio</span>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <p
                className={
                  diferencia === 0
                    ? 'text-xs text-muted-foreground'
                    : 'text-xs font-medium text-destructive'
                }
              >
                Suma de los servicios: {formatearMonto(sumaLineas)}
                {monto !== undefined &&
                  (diferencia === 0
                    ? ' · coincide con el monto'
                    : ` · ${diferencia > 0 ? 'sobran' : 'faltan'} ${formatearMonto(
                        Math.abs(diferencia)
                      )} para llegar al monto`)}
              </p>

              {form.formState.errors.servicios?.message && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.servicios.message}
                </p>
              )}
              {form.formState.errors.servicios?.root?.message && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.servicios.root.message}
                </p>
              )}
            </div>

            <FormField
              control={form.control}
              name="concepto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Concepto</FormLabel>
                  <FormControl>
                    <Input placeholder="Pago afiliación EPS" disabled={guardando} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="monto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
                  <FormControl>
                    <MontoInput
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={guardando}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="categoriaId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={opcionesCategoria}
                        value={field.value || null}
                        onValueChange={(v) => field.onChange(v ?? '')}
                        placeholder="Seleccioná…"
                        searchPlaceholder="Buscar categoría…"
                        disabled={guardando}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bolsilloId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bolsillo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={guardando}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccioná…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {bolsillos.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nota (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      disabled={guardando}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAbierto(false)}
                disabled={guardando}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  'Registrar y emitir recibo'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
