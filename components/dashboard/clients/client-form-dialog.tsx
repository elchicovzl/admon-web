'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient, updateClient } from '@/lib/actions'
import { createClientSchema, type CreateClientInput } from '@/lib/validations/client.schema'
import type { SafeClient } from '@/lib/types/client.types'
import { ClientType, IdentificationType } from '@prisma/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

interface ClientFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClientCreated?: (client: SafeClient) => void
  onClientUpdated?: (clientId: string, updates: Partial<SafeClient>) => void
  editClient?: SafeClient | null
  redirectOnCreate?: boolean
}

export function ClientFormDialog({
  open,
  onOpenChange,
  onClientCreated,
  onClientUpdated,
  editClient,
  redirectOnCreate = true,
}: ClientFormDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const isEditMode = !!editClient

  const form = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      fullName: '',
      identificationType: IdentificationType.CEDULA,
      identificationNumber: '',
      clientType: ClientType.EMPLEADO,
      email: '',
      phone: '',
      status: 'ACTIVO',
      legalRepresentative: undefined,
    },
  })

  // Watch clientType to show/hide legal representative fields
  const clientType = form.watch('clientType')
  const isCompany = clientType === ClientType.EMPRESA

  // Update form when editClient changes
  useEffect(() => {
    if (editClient) {
      form.reset({
        fullName: editClient.fullName,
        identificationType: editClient.identificationType,
        identificationNumber: editClient.identificationNumber,
        clientType: editClient.clientType,
        email: editClient.email,
        phone: editClient.phone,
        status: editClient.status,
        legalRepresentative: undefined,
      })
    } else {
      form.reset({
        fullName: '',
        identificationType: IdentificationType.CEDULA,
        identificationNumber: '',
        clientType: ClientType.EMPLEADO,
        email: '',
        phone: '',
        status: 'ACTIVO',
        legalRepresentative: undefined,
      })
    }
  }, [editClient, form])

  // Clear legal representative data when switching away from EMPRESA
  useEffect(() => {
    if (!isCompany) {
      form.setValue('legalRepresentative', undefined)
    }
  }, [isCompany, form])

  async function onSubmit(data: CreateClientInput) {
    setIsLoading(true)

    try {
      let result

      if (isEditMode && editClient) {
        result = await updateClient(editClient.id, data)

        if (result.success) {
          toast.success(result.message || 'Cliente actualizado exitosamente')
          if (result.data) {
            onClientUpdated?.(editClient.id, result.data)
          }
        } else {
          toast.error(result.error || 'Error al actualizar cliente')
        }
      } else {
        result = await createClient(data)

        if (result.success) {
          toast.success(result.message || 'Cliente creado exitosamente')
          if (result.data) {
            onClientCreated?.(result.data)

            // Redirect to client detail if enabled
            if (redirectOnCreate) {
              form.reset()
              onOpenChange(false)
              router.push(`/dashboard/clients/${result.data.id}`)
              return
            }
          }
        } else {
          toast.error(result.error || 'Error al crear cliente')
        }
      }

      if (result.success) {
        form.reset()
        onOpenChange(false)
      }
    } catch (error) {
      console.error('Submit client error:', error)
      toast.error('Error inesperado al procesar solicitud')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Editar Cliente' : 'Crear Nuevo Cliente'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Actualiza la información del cliente.'
              : 'Completa todos los campos requeridos para crear un nuevo cliente.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Client Information */}
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre completo / Razón Social</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={isCompany ? "Empresa S.A.S." : "Juan Pérez García"}
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="identificationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Identificación</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={IdentificationType.CEDULA}>Cédula</SelectItem>
                        <SelectItem value={IdentificationType.CEDULA_EXTRANJERIA}>
                          Cédula Extranjería
                        </SelectItem>
                        <SelectItem value={IdentificationType.PPT}>PPT</SelectItem>
                        <SelectItem value={IdentificationType.NIT}>NIT</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="identificationNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Identificación</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="123456789"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="clientType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Cliente</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={ClientType.EMPLEADO}>Empleado</SelectItem>
                      <SelectItem value={ClientType.EMPRESA}>Empresa</SelectItem>
                      <SelectItem value={ClientType.INDEPENDIENTE}>Independiente</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="cliente@ejemplo.com"
                      type="email"
                      autoComplete="email"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="+57 300 123 4567"
                      type="tel"
                      autoComplete="tel"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ACTIVO"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Legal Representative Section - Only for Companies */}
            {isCompany && !isEditMode && (
              <>
                <Separator className="my-6" />
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Representante Legal</h3>
                    <p className="text-sm text-muted-foreground">
                      Información del representante legal de la empresa
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="legalRepresentative.fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre Completo *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Juan Pérez García"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="legalRepresentative.identificationType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Identificación *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            disabled={isLoading}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={IdentificationType.CEDULA}>Cédula</SelectItem>
                              <SelectItem value={IdentificationType.CEDULA_EXTRANJERIA}>
                                Cédula Extranjería
                              </SelectItem>
                              <SelectItem value={IdentificationType.PPT}>PPT</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="legalRepresentative.identificationNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Identificación *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="123456789"
                              disabled={isLoading}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="legalRepresentative.email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (Opcional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="representante@ejemplo.com"
                            type="email"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="legalRepresentative.phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono (Opcional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="+57 300 123 4567"
                            type="tel"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? 'Actualizar' : 'Crear Cliente'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
