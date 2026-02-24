'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { IMaskInput } from 'react-imask'
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

// ID types allowed for natural persons
const PERSON_ID_TYPES: { value: IdentificationType; label: string }[] = [
  { value: IdentificationType.CEDULA, label: 'Cédula de Ciudadanía (CC)' },
  { value: IdentificationType.TARJETA_IDENTIDAD, label: 'Tarjeta de Identidad (TI)' },
  { value: IdentificationType.REGISTRO_CIVIL, label: 'Registro Civil (RC)' },
  { value: IdentificationType.CEDULA_EXTRANJERIA, label: 'Cédula de Extranjería (CE)' },
  { value: IdentificationType.PASAPORTE, label: 'Pasaporte (PA)' },
  { value: IdentificationType.PPT, label: 'Permiso de Protección Temporal (PPT)' },
  { value: IdentificationType.PEP, label: 'Permiso Especial de Permanencia (PEP)' },
  { value: IdentificationType.NUIP, label: 'NUIP' },
]

// ID types allowed for companies
const COMPANY_ID_TYPES: { value: IdentificationType; label: string }[] = [
  { value: IdentificationType.NIT, label: 'NIT' },
]

// Mask configuration per identification type
type MaskConfig =
  | { type: 'pattern'; mask: string; placeholder: string }
  | { type: 'regex'; mask: RegExp; placeholder: string }

const ID_MASK_CONFIG: Record<IdentificationType, MaskConfig> = {
  CEDULA:             { type: 'pattern', mask: '0000000000',    placeholder: '1000000000' },
  TARJETA_IDENTIDAD:  { type: 'pattern', mask: '0000000000',    placeholder: '1122334455' },
  REGISTRO_CIVIL:     { type: 'pattern', mask: '00000000000',   placeholder: '11223344556' },
  CEDULA_EXTRANJERIA: { type: 'regex',   mask: /^[A-Za-z0-9]{1,15}$/, placeholder: 'ABC123456' },
  PASAPORTE:          { type: 'regex',   mask: /^[A-Za-z0-9]{1,12}$/, placeholder: 'AA123456' },
  PPT:                { type: 'regex',   mask: /^[A-Za-z0-9\-]{1,20}$/, placeholder: 'PPT-12345678' },
  PEP:                { type: 'regex',   mask: /^[A-Za-z0-9\-]{1,20}$/, placeholder: 'PEP12345678' },
  NUIP:               { type: 'pattern', mask: '0000000000',    placeholder: '1234567890' },
  NIT:                { type: 'pattern', mask: '000000000-0',   placeholder: '123456789-0' },
}

// Colombian phone mask: +57 300 123 4567
const PHONE_MASK = '+57 000 000 0000'
const PHONE_PLACEHOLDER = '+57 300 123 4567'

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
    mode: 'onBlur',
    defaultValues: {
      fullName: '',
      clientType: ClientType.EMPLEADO,
      identificationType: IdentificationType.CEDULA,
      identificationNumber: '',
      email: '',
      phone: '',
      legalRepresentative: undefined,
    },
  })

  // Watch clientType to show/hide legal representative fields and filter ID types
  const clientType = form.watch('clientType')
  const identificationType = form.watch('identificationType')
  const isCompany = clientType === ClientType.EMPRESA

  // Track previous identification type to clear number only when it actually changes
  const prevIdTypeRef = useRef<IdentificationType | null>(null)

  // When switching to/from EMPRESA, reset identification type and number
  useEffect(() => {
    if (isCompany) {
      form.setValue('identificationType', IdentificationType.NIT)
      form.setValue('identificationNumber', '')
    } else {
      // Only reset if the current type is NIT (company-only)
      if (form.getValues('identificationType') === IdentificationType.NIT) {
        form.setValue('identificationType', IdentificationType.CEDULA)
        form.setValue('identificationNumber', '')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompany])

  // Clear identification number when type changes (mask format changes), but not on initial mount
  useEffect(() => {
    if (prevIdTypeRef.current !== null && prevIdTypeRef.current !== identificationType) {
      form.setValue('identificationNumber', '')
    }
    prevIdTypeRef.current = identificationType
  }, [identificationType, form])

  // Clear legal representative data when switching away from EMPRESA
  useEffect(() => {
    if (!isCompany) {
      form.setValue('legalRepresentative', undefined)
    }
  }, [isCompany, form])

  // Update form when editClient changes
  useEffect(() => {
    if (editClient) {
      form.reset({
        fullName: editClient.fullName,
        clientType: editClient.clientType,
        identificationType: editClient.identificationType,
        identificationNumber: editClient.identificationNumber,
        email: editClient.email,
        phone: editClient.phone,
        legalRepresentative: undefined,
      })
    } else {
      form.reset({
        fullName: '',
        clientType: ClientType.EMPLEADO,
        identificationType: IdentificationType.CEDULA,
        identificationNumber: '',
        email: '',
        phone: '',
        legalRepresentative: undefined,
      })
    }
  }, [editClient, form])

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

  const availableIdTypes = isCompany ? COMPANY_ID_TYPES : PERSON_ID_TYPES
  const currentMask = ID_MASK_CONFIG[identificationType]

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
            {/* Full name */}
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre completo / Razón Social</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={isCompany ? 'Empresa S.A.S.' : 'Juan Pérez García'}
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Client type — first */}
            <FormField
              control={form.control}
              name="clientType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Cliente</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
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

            {/* Identification type and number */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="identificationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Identificación</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isLoading || isCompany}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableIdTypes.map((idType) => (
                          <SelectItem key={idType.value} value={idType.value}>
                            {idType.label}
                          </SelectItem>
                        ))}
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
                      <Controller
                        control={form.control}
                        name="identificationNumber"
                        render={({ field: { onChange, onBlur, value } }) => (
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          <IMaskInput
                            mask={currentMask.mask as any}
                            value={value}
                            onAccept={(val: string) => onChange(val)}
                            onBlur={onBlur}
                            placeholder={currentMask.placeholder}
                            disabled={isLoading}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Email */}
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
                      onBlur={() => {
                        field.onBlur()
                        form.trigger('email')
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone with Colombian mask */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Controller
                      control={form.control}
                      name="phone"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <IMaskInput
                          mask={PHONE_MASK}
                          value={value}
                          onAccept={(val: string) => onChange(val)}
                          onBlur={onBlur}
                          placeholder={PHONE_PLACEHOLDER}
                          disabled={isLoading}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      )}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Legal Representative Section - Only for Companies on Create */}
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
                            value={field.value}
                            disabled={isLoading}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PERSON_ID_TYPES.map((idType) => (
                                <SelectItem key={idType.value} value={idType.value}>
                                  {idType.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="legalRepresentative.identificationNumber"
                      render={({ field }) => {
                        const legalRepIdType = form.watch('legalRepresentative.identificationType')
                        const legalMask = legalRepIdType
                          ? ID_MASK_CONFIG[legalRepIdType]
                          : ID_MASK_CONFIG.CEDULA
                        return (
                          <FormItem>
                            <FormLabel>Número de Identificación *</FormLabel>
                            <FormControl>
                              <Controller
                                control={form.control}
                                name="legalRepresentative.identificationNumber"
                                render={({ field: { onChange, onBlur, value } }) => (
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  <IMaskInput
                                    mask={legalMask.mask as any}
                                    value={value ?? ''}
                                    onAccept={(val: string) => onChange(val)}
                                    onBlur={onBlur}
                                    placeholder={legalMask.placeholder}
                                    disabled={isLoading}
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                  />
                                )}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )
                      }}
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
                            onBlur={() => {
                              field.onBlur()
                              form.trigger('legalRepresentative.email')
                            }}
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
                          <Controller
                            control={form.control}
                            name="legalRepresentative.phone"
                            render={({ field: { onChange, onBlur, value } }) => (
                              <IMaskInput
                                mask={PHONE_MASK}
                                value={value ?? ''}
                                onAccept={(val: string) => onChange(val)}
                                onBlur={onBlur}
                                placeholder={PHONE_PLACEHOLDER}
                                disabled={isLoading}
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              />
                            )}
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
