'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { TipoMovimiento, GrupoCategoria } from '@prisma/client'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'

import { createMovimiento } from '@/lib/actions/control.actions'
import {
  createMovimientoSchema,
  type CreateMovimientoInput,
} from '@/lib/validations/control.schema'
import type {
  BolsilloListItem,
  CategoriaListItem,
  ContraparteListItem,
} from '@/lib/types/control.types'
import { hoyComoFechaCalendario } from '@/lib/utils/control-format'

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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** Etiquetas legibles de los grupos, para agrupar el selector de categorías. */
const ETIQUETA_GRUPO: Record<GrupoCategoria, string> = {
  NOMINA_COMPLEMENTARIA: 'Nómina complementaria',
  NOMINA_FIJA: 'Nómina fija',
  COMISION: 'Comisiones',
  SERVICIO_REFERENCIADO: 'Servicios referenciados',
  GASTO_OPERATIVO: 'Gastos operativos',
  GASTO_BIENESTAR: 'Bienestar',
  PRESTAMO_DESEMBOLSO: 'Préstamos — desembolso',
  PRESTAMO_ABONO: 'Préstamos — abono',
  TRASLADO: 'Traslados',
  DEVOLUCION: 'Devoluciones',
  OTRO: 'Otros',
}

const ETIQUETA_TIPO: Record<TipoMovimiento, string> = {
  INGRESO: 'Ingreso — entra plata',
  EGRESO: 'Egreso — sale plata',
  TRASLADO: 'Traslado — entre bolsillos',
}

interface Props {
  bolsillos: BolsilloListItem[]
  categorias: CategoriaListItem[]
  contrapartes: ContraparteListItem[]
}

export function MovimientoFormDialog({ bolsillos, categorias, contrapartes }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const form = useForm<CreateMovimientoInput>({
    resolver: zodResolver(createMovimientoSchema),
    defaultValues: {
      fecha: hoyComoFechaCalendario(),
      tipo: TipoMovimiento.EGRESO,
      concepto: '',
      bolsilloId: '',
      bolsilloDestinoId: null,
      categoriaId: '',
      contraparteId: null,
      notas: null,
    },
  })

  const tipo = form.watch('tipo')
  const esTraslado = tipo === TipoMovimiento.TRASLADO
  const bolsilloOrigen = form.watch('bolsilloId')

  /**
   * El destino solo existe en un traslado. Si el operador elige TRASLADO,
   * carga un destino y después cambia a EGRESO, el valor viejo quedaría en el
   * formulario y el schema lo rechazaría con un mensaje que apunta a un campo
   * que ya no se ve en pantalla.
   */
  useEffect(() => {
    if (!esTraslado) {
      form.setValue('bolsilloDestinoId', null)
    }
  }, [esTraslado, form])

  const categoriasPorGrupo = categorias.reduce<Record<string, CategoriaListItem[]>>(
    (acc, categoria) => {
      ;(acc[categoria.grupo] ??= []).push(categoria)
      return acc
    },
    {}
  )

  async function onSubmit(data: CreateMovimientoInput) {
    setGuardando(true)
    try {
      const resultado = await createMovimiento(data)

      if (resultado.success) {
        toast.success(resultado.message ?? 'Movimiento registrado')
        form.reset({
          fecha: data.fecha,
          tipo: data.tipo,
          concepto: '',
          bolsilloId: data.bolsilloId,
          bolsilloDestinoId: null,
          categoriaId: '',
          contraparteId: null,
          notas: null,
        })
        setAbierto(false)
      } else {
        toast.error(resultado.error ?? 'No se pudo registrar')
      }
    } catch (error) {
      console.error('[control] createMovimiento:', error)
      toast.error('Error inesperado al registrar el movimiento')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo movimiento
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo movimiento</DialogTitle>
          <DialogDescription>
            Los movimientos no se editan ni se borran. Si te equivocás, se anula
            con un contra-movimiento y queda el registro de los dos.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
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
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={guardando}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(TipoMovimiento).map((t) => (
                          <SelectItem key={t} value={t}>
                            {ETIQUETA_TIPO[t]}
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
              name="monto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      placeholder="40000"
                      disabled={guardando}
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === '' ? undefined : e.target.valueAsNumber
                        )
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Siempre en positivo. La dirección la da el tipo, no el signo.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="concepto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Concepto</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Gaseosas para la oficina"
                      disabled={guardando}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="bolsilloId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{esTraslado ? 'Desde' : 'Bolsillo'}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={guardando}
                    >
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

              {esTraslado && (
                <FormField
                  control={form.control}
                  name="bolsilloDestinoId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hacia</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ''}
                        disabled={guardando}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccioná…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {bolsillos
                            // Un traslado a sí mismo no mueve plata pero
                            // ensucia el saldo: no se ofrece siquiera.
                            .filter((b) => b.id !== bolsilloOrigen)
                            .map((b) => (
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
              )}
            </div>

            <FormField
              control={form.control}
              name="categoriaId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={guardando}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccioná…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(categoriasPorGrupo).map(([grupo, items]) => (
                        <SelectGroup key={grupo}>
                          <SelectLabel>
                            {ETIQUETA_GRUPO[grupo as GrupoCategoria] ?? grupo}
                          </SelectLabel>
                          {items.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nombre}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contraparteId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraparte (opcional)</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === '__ninguna__' ? null : v)}
                    value={field.value ?? '__ninguna__'}
                    disabled={guardando}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__ninguna__">Sin contraparte</SelectItem>
                      {contrapartes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Quién recibe o entrega. Es lo que después permite preguntar
                    cuánto se le pagó a alguien en el año.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (opcional)</FormLabel>
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
                  'Registrar'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
