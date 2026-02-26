'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { ClientAddress } from '@/lib/types/client.types'
import { createOrUpdateClientAddress } from '@/lib/actions'
import {
  clientAddressSchema,
  type ClientAddressInput,
} from '@/lib/validations/client-info.schema'
import {
  DEPARTAMENTOS_COLOMBIA,
  getMunicipiosPorDepartamento,
  getDepartamentoLabel,
} from '@/lib/data/colombia-geo'
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
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { MapPin, Edit, Loader2 } from 'lucide-react'

interface ClientAddressSectionProps {
  clientId: string
  initialAddress?: ClientAddress | null
  asSection?: boolean
}

export function ClientAddressSection({ clientId, initialAddress, asSection = false }: ClientAddressSectionProps) {
  const [address, setAddress] = useState<ClientAddress | null>(initialAddress || null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDepartamento, setSelectedDepartamento] = useState<string>(
    initialAddress?.departamento || ''
  )

  const form = useForm<ClientAddressInput>({
    resolver: zodResolver(clientAddressSchema),
    defaultValues: {
      departamento: initialAddress?.departamento || '',
      municipio: initialAddress?.municipio || '',
      ciudad: initialAddress?.ciudad || '',
      direccion: initialAddress?.direccion || '',
    },
  })

  const handleOpenDialog = () => {
    if (address) {
      form.reset({
        departamento: address.departamento,
        municipio: address.municipio,
        ciudad: address.ciudad || '',
        direccion: address.direccion,
      })
      setSelectedDepartamento(address.departamento)
    }
    setIsDialogOpen(true)
  }

  const onSubmit = async (data: ClientAddressInput) => {
    setIsLoading(true)

    try {
      const result = await createOrUpdateClientAddress(clientId, data)

      if (result.success && result.data) {
        toast.success(result.message || 'Dirección guardada exitosamente')
        setAddress(result.data)
        setIsDialogOpen(false)
        form.reset()
      } else {
        toast.error(result.error || 'Error al guardar dirección')
      }
    } catch (error) {
      console.error('Save address error:', error)
      toast.error('Error inesperado al guardar dirección')
    } finally {
      setIsLoading(false)
    }
  }

  const municipios = selectedDepartamento ? getMunicipiosPorDepartamento(selectedDepartamento) : []

  const addressContent = address ? (
    asSection ? (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 pl-6">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Departamento</p>
          <p className="text-sm">{getDepartamentoLabel(address.departamento)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Municipio</p>
          <p className="text-sm">{address.municipio}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Ciudad</p>
          <p className="text-sm">{address.ciudad || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Dirección Completa</p>
          <p className="text-sm">{address.direccion}</p>
        </div>
      </div>
    ) : (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Departamento</p>
            <p className="text-sm">{getDepartamentoLabel(address.departamento)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Municipio</p>
            <p className="text-sm">{address.municipio}</p>
          </div>
        </div>
        {address.ciudad && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Ciudad</p>
            <p className="text-sm">{address.ciudad}</p>
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-muted-foreground">Dirección Completa</p>
          <p className="text-sm">{address.direccion}</p>
        </div>
      </div>
    )
  ) : (
    <p className="text-sm text-muted-foreground text-center py-4">
      No hay dirección registrada
    </p>
  )

  const editButton = (
    <Button onClick={handleOpenDialog} size="sm" variant={asSection ? 'ghost' : 'default'}>
      {address ? (
        <>
          <Edit className="mr-2 h-4 w-4" />
          Editar
        </>
      ) : (
        <>
          <MapPin className="mr-2 h-4 w-4" />
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
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Dirección</p>
            </div>
            {editButton}
          </div>
          {addressContent}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle>Dirección</CardTitle>
                  <CardDescription>Ubicación geográfica del cliente</CardDescription>
                </div>
              </div>
              {editButton}
            </div>
          </CardHeader>
          <CardContent>{addressContent}</CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{address ? 'Editar Dirección' : 'Agregar Dirección'}</DialogTitle>
            <DialogDescription>
              Completa la información de ubicación del cliente
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Departamento */}
              <FormField
                control={form.control}
                name="departamento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departamento</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value)
                        setSelectedDepartamento(value)
                        form.setValue('municipio', '') // Reset municipio when departamento changes
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un departamento" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DEPARTAMENTOS_COLOMBIA.map((dept) => (
                          <SelectItem key={dept.value} value={dept.value}>
                            {dept.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Municipio */}
              <FormField
                control={form.control}
                name="municipio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Municipio</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un municipio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {municipios.length > 0 ? (
                          municipios.map((mun) => (
                            <SelectItem key={mun} value={mun}>
                              {mun}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="py-6 text-center text-sm text-muted-foreground">
                            Selecciona un departamento primero
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Ciudad */}
              <FormField
                control={form.control}
                name="ciudad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ciudad (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Medellín" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Dirección */}
              <FormField
                control={form.control}
                name="direccion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dirección Completa</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ej: Calle 50 # 45-23, Apto 301"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
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
