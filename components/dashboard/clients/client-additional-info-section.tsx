'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { ClientAdditionalInfo } from '@/lib/types/client.types'
import { createOrUpdateClientAdditionalInfo } from '@/lib/actions'
import {
  clientAdditionalInfoSchema,
  type ClientAdditionalInfoInput,
} from '@/lib/validations/client-info.schema'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Briefcase, Edit, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface ClientAdditionalInfoSectionProps {
  clientId: string
  initialInfo?: ClientAdditionalInfo | null
  asSection?: boolean
}

const NOVEDADES_OPTIONS = [
  { id: 'novedad_1', label: 'Novedad 1' },
  { id: 'novedad_2', label: 'Novedad 2' },
  { id: 'novedad_3', label: 'Novedad 3' },
  { id: 'novedad_4', label: 'Novedad 4' },
  { id: 'novedad_5', label: 'Novedad 5' },
]

export function ClientAdditionalInfoSection({
  clientId,
  initialInfo,
  asSection = false,
}: ClientAdditionalInfoSectionProps) {
  const [info, setInfo] = useState<ClientAdditionalInfo | null>(initialInfo || null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<ClientAdditionalInfoInput>({
    resolver: zodResolver(clientAdditionalInfoSchema),
    defaultValues: {
      actividadComercial: initialInfo?.actividadComercial || '',
      salario: initialInfo?.salario || undefined,
      novedadesIngreso: initialInfo?.novedadesIngreso || [],
    },
  })

  const handleOpenDialog = () => {
    if (info) {
      form.reset({
        actividadComercial: info.actividadComercial || '',
        salario: info.salario || undefined,
        novedadesIngreso: info.novedadesIngreso || [],
      })
    }
    setIsDialogOpen(true)
  }

  const onSubmit = async (data: ClientAdditionalInfoInput) => {
    setIsLoading(true)

    try {
      const result = await createOrUpdateClientAdditionalInfo(clientId, data)

      if (result.success && result.data) {
        toast.success(result.message || 'Información guardada exitosamente')
        setInfo(result.data)
        setIsDialogOpen(false)
        form.reset()
      } else {
        toast.error(result.error || 'Error al guardar información')
      }
    } catch (error) {
      console.error('Save additional info error:', error)
      toast.error('Error inesperado al guardar información')
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (value?: number | null) => {
    if (!value) return 'No especificado'
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value)
  }

  const infoContent = info ? (
    asSection ? (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 pl-6">
        <div className="col-span-2">
          <p className="text-xs font-medium text-muted-foreground">Actividad Comercial</p>
          <p className="text-sm">{info.actividadComercial || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Salario</p>
          <p className="text-sm font-semibold">{formatCurrency(info.salario)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Novedades de Ingreso</p>
          {info.novedadesIngreso && info.novedadesIngreso.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {info.novedadesIngreso.map((novedad) => (
                <Badge key={novedad} variant="secondary" className="text-xs">
                  {NOVEDADES_OPTIONS.find((n) => n.id === novedad)?.label || novedad}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>
      </div>
    ) : (
      <div className="space-y-3">
        {info.actividadComercial && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Actividad Comercial</p>
            <p className="text-sm">{info.actividadComercial}</p>
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-muted-foreground">Salario</p>
          <p className="text-sm font-semibold">{formatCurrency(info.salario)}</p>
        </div>
        {info.novedadesIngreso && info.novedadesIngreso.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Novedades de Ingreso
            </p>
            <div className="flex flex-wrap gap-2">
              {info.novedadesIngreso.map((novedad) => (
                <Badge key={novedad} variant="secondary">
                  {NOVEDADES_OPTIONS.find((n) => n.id === novedad)?.label || novedad}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {!info.actividadComercial && !info.salario && info.novedadesIngreso.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay información adicional registrada
          </p>
        )}
      </div>
    )
  ) : (
    <p className="text-sm text-muted-foreground text-center py-4">
      No hay información adicional registrada
    </p>
  )

  const editButton = (
    <Button onClick={handleOpenDialog} size="sm" variant={asSection ? 'ghost' : 'default'}>
      {info ? (
        <>
          <Edit className="mr-2 h-4 w-4" />
          Editar
        </>
      ) : (
        <>
          <Briefcase className="mr-2 h-4 w-4" />
          Agregar
        </>
      )}
    </Button>
  )

  return (
    <>
      {asSection ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Información Adicional</p>
            </div>
            {editButton}
          </div>
          {infoContent}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle>Información Adicional</CardTitle>
                  <CardDescription>Información laboral y familiar</CardDescription>
                </div>
              </div>
              {editButton}
            </div>
          </CardHeader>
          <CardContent>{infoContent}</CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {info ? 'Editar Información Adicional' : 'Agregar Información Adicional'}
            </DialogTitle>
            <DialogDescription>
              Completa la información laboral y familiar del cliente
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Actividad Comercial */}
              <FormField
                control={form.control}
                name="actividadComercial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Actividad Comercial</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Comercio al por menor, Servicios profesionales"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Puede ingresar código CIIU o descripción
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Salario */}
              <FormField
                control={form.control}
                name="salario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salario</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="2500000"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value
                          field.onChange(value ? parseFloat(value) : undefined)
                        }}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Ingrese el salario en pesos colombianos (COP)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Novedades de Ingreso */}
              <FormField
                control={form.control}
                name="novedadesIngreso"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel>Novedades de Ingreso</FormLabel>
                      <FormDescription className="text-xs">
                        Seleccione las novedades aplicables
                      </FormDescription>
                    </div>
                    <div className="space-y-2">
                      {NOVEDADES_OPTIONS.map((option) => (
                        <FormField
                          key={option.id}
                          control={form.control}
                          name="novedadesIngreso"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={option.id}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(option.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, option.id])
                                        : field.onChange(
                                            field.value?.filter((value) => value !== option.id)
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  {option.label}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
