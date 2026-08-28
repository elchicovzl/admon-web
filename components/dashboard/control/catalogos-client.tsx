'use client'

import { useState } from 'react'
import {
  GrupoCategoria,
  TipoBolsillo,
  TipoContraparte,
} from '@prisma/client'
import { toast } from 'sonner'
import { Loader2, Plus, Lock, RefreshCw } from 'lucide-react'

import {
  createBolsillo,
  setBolsilloActivo,
  createCategoria,
  setCategoriaActiva,
  createTipoServicio,
  setTipoServicioActivo,
  createContraparte,
  setContraparteActiva,
  sincronizarServiciosAlegra,
  setServicioAlegraActivo,
  setServicioAlegraEnTransito,
  setCategoriaEgresoDeServicio,
} from '@/lib/actions/control.actions'
import type {
  BolsilloListItem,
  CategoriaListItem,
  TipoServicioListItem,
  ContraparteListItem,
  ServicioAlegraListItem,
} from '@/lib/types/control.types'
import { formatearFecha } from '@/lib/utils/control-format'
import {
  ETIQUETA_GRUPO,
  DESCRIPCION_GRUPO,
  ETIQUETA_TIPO_BOLSILLO,
  ETIQUETA_TIPO_CONTRAPARTE,
} from './etiquetas'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { cn } from '@/lib/utils'

interface Props {
  bolsillos: BolsilloListItem[]
  categorias: CategoriaListItem[]
  tiposServicio: TipoServicioListItem[]
  contrapartes: ContraparteListItem[]
  /** Catálogo de Alegra: qué se vendió. Ver la pestaña "Servicios Alegra". */
  serviciosAlegra: ServicioAlegraListItem[]
}

/** Switch de activo/inactivo compartido por las cuatro tablas. */
function SwitchActivo({
  activo,
  onCambiar,
}: {
  activo: boolean
  onCambiar: (valor: boolean) => Promise<void>
}) {
  const [enviando, setEnviando] = useState(false)

  return (
    <Switch
      checked={activo}
      disabled={enviando}
      aria-label={activo ? 'Desactivar' : 'Activar'}
      onCheckedChange={async (valor) => {
        setEnviando(true)
        try {
          await onCambiar(valor)
        } finally {
          setEnviando(false)
        }
      }}
    />
  )
}

/** Envoltorio del formulario de alta que llevan todas las pestañas. */
function FormularioAlta({
  children,
  onCrear,
  puedeCrear,
  etiqueta = 'Crear',
}: {
  children: React.ReactNode
  onCrear: () => Promise<void>
  puedeCrear: boolean
  etiqueta?: string
}) {
  const [enviando, setEnviando] = useState(false)

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/40 p-3">
      {children}
      <Button
        size="sm"
        disabled={!puedeCrear || enviando}
        onClick={async () => {
          setEnviando(true)
          try {
            await onCrear()
          } finally {
            setEnviando(false)
          }
        }}
      >
        {enviando ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Plus className="mr-2 h-4 w-4" />
        )}
        {etiqueta}
      </Button>
    </div>
  )
}

export function CatalogosClient({
  bolsillos,
  categorias,
  tiposServicio,
  contrapartes,
  serviciosAlegra,
}: Props) {
  // Estado local para que lo creado aparezca al instante sin recargar.
  const [listaBolsillos, setListaBolsillos] = useState(bolsillos)
  const [listaCategorias, setListaCategorias] = useState(categorias)
  const [listaServicios, setListaServicios] = useState(tiposServicio)
  const [listaContrapartes, setListaContrapartes] = useState(contrapartes)
  const [listaAlegra, setListaAlegra] = useState(serviciosAlegra)
  const [sincronizando, setSincronizando] = useState(false)

  // Formularios de alta
  const [nuevoBolsillo, setNuevoBolsillo] = useState<{
    nombre: string
    tipo: TipoBolsillo
  }>({ nombre: '', tipo: TipoBolsillo.EFECTIVO })
  const [nuevaCategoria, setNuevaCategoria] = useState<{
    nombre: string
    grupo: GrupoCategoria
  }>({ nombre: '', grupo: GrupoCategoria.GASTO_OPERATIVO })
  const [nuevoServicio, setNuevoServicio] = useState({ nombre: '', categoriaId: '' })
  const [nuevaContraparte, setNuevaContraparte] = useState<{
    nombre: string
    tipo: TipoContraparte
    documento: string
  }>({ nombre: '', tipo: TipoContraparte.PROVEEDOR, documento: '' })

  const categoriasDeServicio = listaCategorias.filter(
    (c) => c.grupo === GrupoCategoria.SERVICIO_REFERENCIADO && c.isActive
  )

  return (
    <Tabs defaultValue="bolsillos">
      <TabsList className="flex-wrap">
        <TabsTrigger value="bolsillos">Bolsillos</TabsTrigger>
        <TabsTrigger value="categorias">Categorías</TabsTrigger>
        <TabsTrigger value="servicios">Servicios</TabsTrigger>
        <TabsTrigger value="servicios-alegra">Servicios Alegra</TabsTrigger>
        <TabsTrigger value="contrapartes">Contrapartes</TabsTrigger>
        <TabsTrigger value="grupos">Grupos</TabsTrigger>
      </TabsList>

      {/* ─────────────────────────────── Bolsillos ─────────────────────────── */}
      <TabsContent value="bolsillos" className="space-y-4">
        <p className="text-sm text-muted-foreground">
          De dónde sale y a dónde entra la plata. Un bolsillo que se deja de usar
          se cierra, no se borra: sus movimientos históricos siguen contando.
        </p>

        <FormularioAlta
          puedeCrear={nuevoBolsillo.nombre.trim().length >= 2}
          onCrear={async () => {
            const r = await createBolsillo({
              nombre: nuevoBolsillo.nombre,
              tipo: nuevoBolsillo.tipo,
              orden: listaBolsillos.length,
            })
            if (r.success && r.data) {
              setListaBolsillos((a) => [...a, r.data!])
              setNuevoBolsillo({ nombre: '', tipo: TipoBolsillo.EFECTIVO })
              toast.success(r.message ?? 'Bolsillo creado')
            } else {
              toast.error(r.error ?? 'No se pudo crear')
            }
          }}
        >
          <Input
            placeholder="Nombre del bolsillo"
            className="w-56"
            value={nuevoBolsillo.nombre}
            onChange={(e) =>
              setNuevoBolsillo((v) => ({ ...v, nombre: e.target.value }))
            }
          />
          <Select
            value={nuevoBolsillo.tipo}
            onValueChange={(v) =>
              setNuevoBolsillo((s) => ({ ...s, tipo: v as TipoBolsillo }))
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(TipoBolsillo).map((t) => (
                <SelectItem key={t} value={t}>
                  {ETIQUETA_TIPO_BOLSILLO[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormularioAlta>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cerrado</TableHead>
                <TableHead className="w-[90px] text-right">Activo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listaBolsillos.map((b) => (
                <TableRow key={b.id} className={cn(!b.isActive && 'opacity-50')}>
                  <TableCell className="font-medium">{b.nombre}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {ETIQUETA_TIPO_BOLSILLO[b.tipo]}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {b.cerradoEn ? formatearFecha(b.cerradoEn) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <SwitchActivo
                      activo={b.isActive}
                      onCambiar={async (valor) => {
                        const r = await setBolsilloActivo({ id: b.id, isActive: valor })
                        if (r.success) {
                          setListaBolsillos((a) =>
                            a.map((x) =>
                              x.id === b.id
                                ? { ...x, isActive: valor, cerradoEn: valor ? null : new Date() }
                                : x
                            )
                          )
                          toast.success(r.message ?? 'Listo')
                        } else toast.error(r.error ?? 'No se pudo')
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      {/* ─────────────────────────────── Categorías ────────────────────────── */}
      <TabsContent value="categorias" className="space-y-4">
        <p className="text-sm text-muted-foreground">
          El "qué" de cada movimiento. El grupo define en qué renglón aparece en
          los reportes, y por eso es obligatorio.
        </p>

        <FormularioAlta
          puedeCrear={nuevaCategoria.nombre.trim().length >= 2}
          onCrear={async () => {
            const r = await createCategoria(nuevaCategoria)
            if (r.success && r.data) {
              setListaCategorias((a) =>
                a.some((c) => c.id === r.data!.id) ? a : [...a, r.data!]
              )
              setNuevaCategoria({
                nombre: '',
                grupo: GrupoCategoria.GASTO_OPERATIVO,
              })
              toast.success(r.message ?? 'Categoría creada')
            } else {
              toast.error(r.error ?? 'No se pudo crear')
            }
          }}
        >
          <Input
            placeholder="Nombre de la categoría"
            className="w-64"
            value={nuevaCategoria.nombre}
            onChange={(e) =>
              setNuevaCategoria((v) => ({ ...v, nombre: e.target.value }))
            }
          />
          <Select
            value={nuevaCategoria.grupo}
            onValueChange={(v) =>
              setNuevaCategoria((s) => ({ ...s, grupo: v as GrupoCategoria }))
            }
          >
            <SelectTrigger className="w-56">
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
        </FormularioAlta>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead className="w-[90px] text-right">Activa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listaCategorias.map((c) => (
                <TableRow key={c.id} className={cn(!c.isActive && 'opacity-50')}>
                  <TableCell className="font-medium">{c.nombre}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ETIQUETA_GRUPO[c.grupo]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <SwitchActivo
                      activo={c.isActive}
                      onCambiar={async (valor) => {
                        const r = await setCategoriaActiva({ id: c.id, isActive: valor })
                        if (r.success) {
                          setListaCategorias((a) =>
                            a.map((x) => (x.id === c.id ? { ...x, isActive: valor } : x))
                          )
                        } else toast.error(r.error ?? 'No se pudo')
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      {/* ────────────────────────── Tipos de servicio ──────────────────────── */}
      <TabsContent value="servicios" className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Servicios que Admon intermedia: cobra, entrega a un tercero y a veces
          deja margen. Cada uno apunta a la categoría con la que se registran sus
          dos patas de movimiento.
        </p>

        {categoriasDeServicio.length === 0 && (
          <Alert>
            <AlertTitle>Falta una categoría</AlertTitle>
            <AlertDescription>
              <p>
                Para crear un servicio hace falta al menos una categoría activa del
                grupo &quot;Servicios referenciados&quot;. Creala en la pestaña de
                Categorías.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <FormularioAlta
          puedeCrear={
            nuevoServicio.nombre.trim().length >= 2 && Boolean(nuevoServicio.categoriaId)
          }
          onCrear={async () => {
            const r = await createTipoServicio(nuevoServicio)
            if (r.success && r.data) {
              setListaServicios((a) => [...a, r.data!])
              setNuevoServicio({ nombre: '', categoriaId: '' })
              toast.success(r.message ?? 'Servicio creado')
            } else {
              toast.error(r.error ?? 'No se pudo crear')
            }
          }}
        >
          <Input
            placeholder="Nombre del servicio"
            className="w-56"
            value={nuevoServicio.nombre}
            onChange={(e) =>
              setNuevoServicio((v) => ({ ...v, nombre: e.target.value }))
            }
          />
          <div className="w-64">
            <SearchableSelect
              options={categoriasDeServicio.map((c) => ({
                value: c.id,
                label: c.nombre,
              }))}
              value={nuevoServicio.categoriaId || null}
              onValueChange={(v) =>
                setNuevoServicio((s) => ({ ...s, categoriaId: v ?? '' }))
              }
              placeholder="Categoría del servicio…"
            />
          </div>
        </FormularioAlta>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Servicio</TableHead>
                <TableHead>Categoría de sus movimientos</TableHead>
                <TableHead className="w-[90px] text-right">Activo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listaServicios.map((s) => (
                <TableRow key={s.id} className={cn(!s.isActive && 'opacity-50')}>
                  <TableCell className="font-medium">{s.nombre}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.categoria.nombre}
                  </TableCell>
                  <TableCell className="text-right">
                    <SwitchActivo
                      activo={s.isActive}
                      onCambiar={async (valor) => {
                        const r = await setTipoServicioActivo({ id: s.id, isActive: valor })
                        if (r.success) {
                          setListaServicios((a) =>
                            a.map((x) => (x.id === s.id ? { ...x, isActive: valor } : x))
                          )
                        } else toast.error(r.error ?? 'No se pudo')
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      {/* ──────────────────────────── Servicios Alegra ─────────────────────── */}
      <TabsContent value="servicios-alegra" className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Espejo del catálogo de Alegra: lo que aparece como línea en una
          cotización o en una factura. Responde <em>qué se vendió</em>, que es
          otra pregunta que <em>qué naturaleza de plata es</em> — eso lo siguen
          contestando las categorías.
        </p>

        <Alert>
          <AlertTitle>Este catálogo no se edita a mano</AlertTitle>
          <AlertDescription>
            <p>
              Los servicios se dan de alta en Alegra y desde acá solo se
              sincronizan. Lo único que se decide en Control es cuáles son plata
              en tránsito.
            </p>
          </AlertDescription>
        </Alert>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            disabled={sincronizando}
            onClick={async () => {
              setSincronizando(true)
              try {
                const r = await sincronizarServiciosAlegra()
                if (r.success && r.data) {
                  setListaAlegra(r.data.servicios)
                  toast.success(r.message ?? 'Catálogo sincronizado')
                } else {
                  toast.error(r.error ?? 'No se pudo sincronizar')
                }
              } finally {
                setSincronizando(false)
              }
            }}
          >
            {sincronizando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sincronizar con Alegra
          </Button>
          <span className="text-sm text-muted-foreground">
            {listaAlegra.length} servicios
          </span>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Servicio</TableHead>
                <TableHead className="w-24">Ref.</TableHead>
                <TableHead className="w-40">En tránsito</TableHead>
                <TableHead className="w-56">Sale por</TableHead>
                <TableHead className="w-32">Sincronizado</TableHead>
                <TableHead className="w-24">Activo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listaAlegra.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Todavía no se sincronizó el catálogo.
                  </TableCell>
                </TableRow>
              )}
              {listaAlegra.map((servicio) => (
                <TableRow key={servicio.id} className={cn(!servicio.isActive && 'opacity-50')}>
                  <TableCell>
                    <div className="font-medium">{servicio.nombre}</div>
                    {servicio.descripcion && (
                      <div className="text-xs text-muted-foreground">
                        {servicio.descripcion}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {servicio.referencia ? (
                      <Badge variant="outline">{servicio.referencia}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <SwitchActivo
                        activo={servicio.enTransito}
                        onCambiar={async (valor) => {
                          const r = await setServicioAlegraEnTransito({
                            id: servicio.id,
                            enTransito: valor,
                          })
                          if (r.success) {
                            setListaAlegra((a) =>
                              a.map((x) =>
                                x.id === servicio.id ? { ...x, enTransito: valor } : x
                              )
                            )
                            toast.success(r.message ?? 'Listo')
                          } else {
                            toast.error(r.error ?? 'No se pudo cambiar')
                          }
                        }}
                      />
                      {servicio.enTransito && (
                        <Badge variant="secondary">No es ingreso</Badge>
                      )}
                    </div>
                  </TableCell>
                  {/* Solo tiene sentido en un servicio en tránsito: es por
                      dónde vuelve a salir esa plata. Sin el vínculo, "entra y
                      sale" no se puede verificar contra nada. */}
                  <TableCell>
                    {servicio.enTransito ? (
                      <SearchableSelect
                        options={[
                          { value: '__ninguna__', label: 'Sin registrar la salida' },
                          ...listaCategorias
                            .filter((c) => c.isActive)
                            .map((c) => ({
                              value: c.id,
                              label: `${c.nombre} · ${ETIQUETA_GRUPO[c.grupo] ?? c.grupo}`,
                            })),
                        ]}
                        value={servicio.categoriaEgreso?.id ?? '__ninguna__'}
                        onValueChange={async (v) => {
                          const categoriaEgresoId = !v || v === '__ninguna__' ? null : v
                          const r = await setCategoriaEgresoDeServicio({
                            id: servicio.id,
                            categoriaEgresoId,
                          })
                          if (r.success) {
                            const cat = listaCategorias.find((c) => c.id === categoriaEgresoId)
                            setListaAlegra((a) =>
                              a.map((x) =>
                                x.id === servicio.id
                                  ? {
                                      ...x,
                                      categoriaEgreso: cat
                                        ? { id: cat.id, nombre: cat.nombre }
                                        : null,
                                    }
                                  : x
                              )
                            )
                            toast.success(r.message ?? 'Listo')
                          } else {
                            toast.error(r.error ?? 'No se pudo asignar')
                          }
                        }}
                        placeholder="Sin registrar la salida"
                        searchPlaceholder="Buscar categoría…"
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {servicio.sincronizadoEn ? formatearFecha(servicio.sincronizadoEn) : '—'}
                  </TableCell>
                  <TableCell>
                    <SwitchActivo
                      activo={servicio.isActive}
                      onCambiar={async (valor) => {
                        const r = await setServicioAlegraActivo({
                          id: servicio.id,
                          isActive: valor,
                        })
                        if (r.success) {
                          setListaAlegra((a) =>
                            a.map((x) => (x.id === servicio.id ? { ...x, isActive: valor } : x))
                          )
                        } else {
                          toast.error(r.error ?? 'No se pudo cambiar')
                        }
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      {/* ────────────────────────────── Contrapartes ───────────────────────── */}
      <TabsContent value="contrapartes" className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Quién recibe o entrega. Es lo que después permite preguntar cuánto se le
          pagó a alguien en el año. El documento va solo con dígitos, sin el de
          verificación: el NIT 901485874-1 se guarda como 901485874.
        </p>

        <FormularioAlta
          puedeCrear={nuevaContraparte.nombre.trim().length >= 2}
          onCrear={async () => {
            const r = await createContraparte({
              nombre: nuevaContraparte.nombre,
              tipo: nuevaContraparte.tipo,
              documento: nuevaContraparte.documento.trim() || null,
            })
            if (r.success && r.data) {
              setListaContrapartes((a) => [...a, r.data!])
              setNuevaContraparte({
                nombre: '',
                tipo: TipoContraparte.PROVEEDOR,
                documento: '',
              })
              toast.success(r.message ?? 'Contraparte creada')
            } else {
              toast.error(r.error ?? 'No se pudo crear')
            }
          }}
        >
          <Input
            placeholder="Nombre completo"
            className="w-56"
            value={nuevaContraparte.nombre}
            onChange={(e) =>
              setNuevaContraparte((v) => ({ ...v, nombre: e.target.value }))
            }
          />
          <Select
            value={nuevaContraparte.tipo}
            onValueChange={(v) =>
              setNuevaContraparte((s) => ({ ...s, tipo: v as TipoContraparte }))
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(TipoContraparte).map((t) => (
                <SelectItem key={t} value={t}>
                  {ETIQUETA_TIPO_CONTRAPARTE[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Documento (opcional)"
            className="w-44"
            inputMode="numeric"
            value={nuevaContraparte.documento}
            onChange={(e) =>
              setNuevaContraparte((v) => ({
                ...v,
                documento: e.target.value.replace(/\D/g, ''),
              }))
            }
          />
        </FormularioAlta>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead className="w-[90px] text-right">Activa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listaContrapartes.map((c) => (
                <TableRow key={c.id} className={cn(!c.isActive && 'opacity-50')}>
                  <TableCell className="font-medium">{c.nombre}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ETIQUETA_TIPO_CONTRAPARTE[c.tipo]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {c.documento ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <SwitchActivo
                      activo={c.isActive}
                      onCambiar={async (valor) => {
                        const r = await setContraparteActiva({ id: c.id, isActive: valor })
                        if (r.success) {
                          setListaContrapartes((a) =>
                            a.map((x) => (x.id === c.id ? { ...x, isActive: valor } : x))
                          )
                        } else toast.error(r.error ?? 'No se pudo')
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      {/* ──────────────────────────────── Grupos ───────────────────────────── */}
      <TabsContent value="grupos" className="space-y-4">
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>Los grupos no se editan, y es a propósito</AlertTitle>
          <AlertDescription>
            <p>
              No son datos: son parte del código. El sistema se ramifica sobre
              varios de ellos — el saldo de un préstamo, por ejemplo, se calcula
              sumando los movimientos del grupo &quot;Préstamos — abono&quot;. Si se
              pudiera borrar desde acá, los saldos quedarían en cero sin que nada
              avisara. Agregar un grupo nuevo es una migración, no una operación del
              día a día.
            </p>
          </AlertDescription>
        </Alert>

        <div className="grid gap-3 md:grid-cols-2">
          {Object.values(GrupoCategoria).map((g) => {
            const info = DESCRIPCION_GRUPO[g]
            const cuantas = listaCategorias.filter((c) => c.grupo === g).length

            return (
              <Card key={g}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{ETIQUETA_GRUPO[g]}</p>
                    <Badge variant="secondary" className="shrink-0">
                      {cuantas} categoría{cuantas === 1 ? '' : 's'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{info.que}</p>
                  {info.usadoPorElSistema && (
                    <p className="rounded border-l-2 border-amber-500/60 bg-amber-500/5 px-2 py-1 text-xs text-muted-foreground">
                      {info.usadoPorElSistema}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </TabsContent>
    </Tabs>
  )
}
