'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { TipoMovimiento, GrupoCategoria } from '@prisma/client'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'

import { createMovimiento, createCategoria } from '@/lib/actions/control.actions'
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { MontoInput } from './monto-input'
import { ETIQUETA_GRUPO, ETIQUETA_TIPO_MOVIMIENTO } from './etiquetas'

interface Props {
  bolsillos: BolsilloListItem[]
  categorias: CategoriaListItem[]
  contrapartes: ContraparteListItem[]
}

export function MovimientoFormDialog({ bolsillos, categorias, contrapartes }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)

  /**
   * Las categorías se guardan en estado local, no se leen de las props, porque
   * se pueden crear sin salir de este formulario y tienen que aparecer en el
   * selector al instante.
   */
  const [catalogo, setCatalogo] = useState(categorias)
  const [creandoCategoria, setCreandoCategoria] = useState(false)
  const [nombreNuevaCategoria, setNombreNuevaCategoria] = useState('')
  const [grupoNuevaCategoria, setGrupoNuevaCategoria] = useState<GrupoCategoria>(
    GrupoCategoria.GASTO_OPERATIVO
  )
  const [guardandoCategoria, setGuardandoCategoria] = useState(false)

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

  /**
   * El grupo va dentro de la etiqueta, no como encabezado.
   *
   * Un selector agrupado se lee lindo con diez opciones; con veintiséis hay
   * que scrollear. Metiendo el grupo en el texto se gana la búsqueda: escribir
   * "gasto" filtra todos los operativos, y escribir "burbuja" encuentra la
   * categoría sin saber en qué grupo cayó.
   */
  const opcionesCategoria = catalogo.map((categoria) => ({
    value: categoria.id,
    label: `${categoria.nombre} · ${ETIQUETA_GRUPO[categoria.grupo] ?? categoria.grupo}`,
  }))

  const opcionesContraparte = [
    { value: '__ninguna__', label: 'Sin contraparte' },
    ...contrapartes.map((c) => ({ value: c.id, label: c.nombre })),
  ]

  async function crearCategoria() {
    setGuardandoCategoria(true)
    try {
      const resultado = await createCategoria({
        nombre: nombreNuevaCategoria,
        grupo: grupoNuevaCategoria,
      })

      if (resultado.success && resultado.data) {
        const creada = resultado.data
        // Puede venir una que ya existía: en ese caso no se duplica en la lista.
        setCatalogo((actual) =>
          actual.some((c) => c.id === creada.id) ? actual : [...actual, creada]
        )
        form.setValue('categoriaId', creada.id, { shouldValidate: true })
        toast.success(resultado.message ?? 'Categoría creada')
        setCreandoCategoria(false)
        setNombreNuevaCategoria('')
      } else {
        toast.error(resultado.error ?? 'No se pudo crear la categoría')
      }
    } finally {
      setGuardandoCategoria(false)
    }
  }

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
                            {ETIQUETA_TIPO_MOVIMIENTO[t]}
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
                    <MontoInput
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={guardando}
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
                  <div className="flex items-center justify-between">
                    <FormLabel>Categoría</FormLabel>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      disabled={guardando}
                      onClick={() => setCreandoCategoria((v) => !v)}
                    >
                      {creandoCategoria ? 'Cancelar' : '+ Crear categoría'}
                    </Button>
                  </div>

                  <FormControl>
                    <SearchableSelect
                      options={opcionesCategoria}
                      value={field.value || null}
                      onValueChange={(v) => field.onChange(v ?? '')}
                      placeholder="Buscá o seleccioná…"
                      searchPlaceholder="Escribí para filtrar…"
                      disabled={guardando}
                    />
                  </FormControl>

                  {/* Crear una categoría sin salir del formulario. Exige el
                      grupo: sin clasificar, el catálogo degenera hasta volver
                      a ser la columna de 93 conceptos del Excel. */}
                  {creandoCategoria && (
                    <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                      <Input
                        placeholder="Nombre de la categoría"
                        value={nombreNuevaCategoria}
                        onChange={(e) => setNombreNuevaCategoria(e.target.value)}
                        disabled={guardandoCategoria}
                      />
                      <Select
                        value={grupoNuevaCategoria}
                        onValueChange={(v) =>
                          setGrupoNuevaCategoria(v as GrupoCategoria)
                        }
                        disabled={guardandoCategoria}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(GrupoCategoria).map((g) => (
                            <SelectItem key={g} value={g}>
                              {ETIQUETA_GRUPO[g]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        El grupo define en qué renglón aparece en los reportes.
                        Buscá antes de crear: si ya existe con otro nombre, se
                        parten los totales en dos.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        className="w-full"
                        disabled={
                          guardandoCategoria || nombreNuevaCategoria.trim().length < 2
                        }
                        onClick={crearCategoria}
                      >
                        {guardandoCategoria && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Crear y seleccionar
                      </Button>
                    </div>
                  )}

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
                  <FormControl>
                    {/* Buscable igual que las categorías: hoy son cuatro, pero
                        esta lista crece con cada persona a la que se le paga. */}
                    <SearchableSelect
                      options={opcionesContraparte}
                      value={field.value ?? '__ninguna__'}
                      onValueChange={(v) =>
                        field.onChange(!v || v === '__ninguna__' ? null : v)
                      }
                      placeholder="Sin contraparte"
                      searchPlaceholder="Buscar persona o empresa…"
                      disabled={guardando}
                    />
                  </FormControl>
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
