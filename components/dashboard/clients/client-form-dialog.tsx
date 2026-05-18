'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { IMaskInput } from 'react-imask'
import {
  createClient,
  updateClient,
  createOrUpdateClientAddress,
  createOrUpdateClientAdditionalInfo,
} from '@/lib/actions'
import {
  createClientSchema,
  updateClientWithContactSchema,
  type CreateClientInput,
  type UpdateClientWithContactInput,
} from '@/lib/validations/client.schema'
import type {
  SafeClient,
  ClientAddress,
  ClientAdditionalInfo,
} from '@/lib/types/client.types'
import {
  DEPARTAMENTOS_COLOMBIA,
  getMunicipiosPorDepartamento,
} from '@/lib/data/colombia-geo'
import { ClientType, IdentificationType, EmployeeType, WorkDaysRange } from '@prisma/client'
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
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2, MapPin, Briefcase } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

interface ContactInfoUpdate {
  address?: ClientAddress | null
  additionalInfo?: ClientAdditionalInfo | null
}

interface ClientFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClientCreated?: (client: SafeClient) => void
  onClientUpdated?: (clientId: string, updates: Partial<SafeClient>) => void
  editClient?: SafeClient | null
  editAddress?: ClientAddress | null
  editAdditionalInfo?: ClientAdditionalInfo | null
  onContactInfoUpdated?: (data: ContactInfoUpdate) => void
  redirectOnCreate?: boolean
}

function toDateInputValue(date?: Date | null): string {
  if (!date) return ''
  const d = new Date(date)
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type ClientFormValues = CreateClientInput & {
  address?: UpdateClientWithContactInput['address']
  additionalInfo?: UpdateClientWithContactInput['additionalInfo']
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
  { value: IdentificationType.SALVOCONDUCTO, label: 'Salvoconducto' },
]

// ID types allowed for companies (personas naturales y jurídicas)
const ALL_ID_TYPES: { value: IdentificationType; label: string }[] = [
  { value: IdentificationType.CEDULA, label: 'Cédula de Ciudadanía (CC)' },
  { value: IdentificationType.TARJETA_IDENTIDAD, label: 'Tarjeta de Identidad (TI)' },
  { value: IdentificationType.REGISTRO_CIVIL, label: 'Registro Civil (RC)' },
  { value: IdentificationType.CEDULA_EXTRANJERIA, label: 'Cédula de Extranjería (CE)' },
  { value: IdentificationType.PASAPORTE, label: 'Pasaporte (PA)' },
  { value: IdentificationType.PPT, label: 'Permiso de Protección Temporal (PPT)' },
  { value: IdentificationType.PEP, label: 'Permiso Especial de Permanencia (PEP)' },
  { value: IdentificationType.NUIP, label: 'NUIP' },
  { value: IdentificationType.SALVOCONDUCTO, label: 'Salvoconducto' },
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
  SALVOCONDUCTO:      { type: 'regex',   mask: /^[A-Za-z0-9\-]{1,20}$/, placeholder: 'SC-12345678' },
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
  editAddress,
  editAdditionalInfo,
  onContactInfoUpdated,
  redirectOnCreate = true,
}: ClientFormDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const isEditMode = !!editClient

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (isEditMode ? updateClientWithContactSchema : createClientSchema) as any
    ),
    mode: 'onBlur',
    defaultValues: {
      fullName: '',
      clientType: ClientType.EMPLEADO,
      identificationType: IdentificationType.CEDULA,
      identificationNumber: '',
      email: '',
      phone: '',
      employeeType: undefined,
      workDaysRange: undefined,
      legalRepresentative: undefined,
      address: {
        departamento: '',
        municipio: '',
        ciudad: '',
        direccion: '',
      },
      additionalInfo: {
        actividadComercial: '',
        salario: undefined,
        fechaIngreso: '',
        fechaRetiro: '',
      },
    },
  })

  const addressDepartamento = form.watch('address.departamento') || ''
  const municipios = addressDepartamento
    ? getMunicipiosPorDepartamento(addressDepartamento)
    : []

  // Watch clientType to show/hide legal representative fields and filter ID types
  const clientType = form.watch('clientType')
  const identificationType = form.watch('identificationType')
  const employeeType = form.watch('employeeType')
  const isCompany = clientType === ClientType.EMPRESA
  const isEmployee = clientType === ClientType.EMPLEADO
  const isPartTime = employeeType === EmployeeType.TIEMPO_PARCIAL

  // Track previous identification type to clear number only when it actually changes
  const prevIdTypeRef = useRef<IdentificationType | null>(null)

  // When switching away from EMPRESA, reset NIT to CEDULA (NIT no aplica para personas naturales)
  useEffect(() => {
    if (!isCompany) {
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

  // Clear employee type fields when switching away from EMPLEADO
  useEffect(() => {
    if (!isEmployee) {
      form.setValue('employeeType', undefined)
      form.setValue('workDaysRange', undefined)
    }
  }, [isEmployee, form])

  // Clear workDaysRange when switching away from TIEMPO_PARCIAL
  useEffect(() => {
    if (!isPartTime) {
      form.setValue('workDaysRange', undefined)
    }
  }, [isPartTime, form])

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
        employeeType: editClient.employeeType ?? undefined,
        workDaysRange: editClient.workDaysRange ?? undefined,
        legalRepresentative: undefined,
        address: {
          departamento: editAddress?.departamento ?? '',
          municipio: editAddress?.municipio ?? '',
          ciudad: editAddress?.ciudad ?? '',
          direccion: editAddress?.direccion ?? '',
        },
        additionalInfo: {
          actividadComercial: editAdditionalInfo?.actividadComercial ?? '',
          salario: editAdditionalInfo?.salario ?? undefined,
          fechaIngreso: toDateInputValue(editAdditionalInfo?.fechaIngreso),
          fechaRetiro: toDateInputValue(editAdditionalInfo?.fechaRetiro),
        },
      })
    } else {
      form.reset({
        fullName: '',
        clientType: ClientType.EMPLEADO,
        identificationType: IdentificationType.CEDULA,
        identificationNumber: '',
        email: '',
        phone: '',
        employeeType: undefined,
        workDaysRange: undefined,
        legalRepresentative: undefined,
        address: {
          departamento: '',
          municipio: '',
          ciudad: '',
          direccion: '',
        },
        additionalInfo: {
          actividadComercial: '',
          salario: undefined,
          fechaIngreso: '',
          fechaRetiro: '',
        },
      })
    }
  }, [editClient, editAddress, editAdditionalInfo, form])

  async function onSubmit(data: ClientFormValues) {
    setIsLoading(true)

    try {
      let result

      if (isEditMode && editClient) {
        const { address, additionalInfo, ...clientData } = data
        result = await updateClient(editClient.id, clientData)

        if (!result.success) {
          toast.error(result.error || 'Error al actualizar cliente')
          return
        }

        const contactUpdates: ContactInfoUpdate = {}

        // Save address only if any field is filled (after validation, all required ones are present)
        const addressFilled = !!(
          address?.departamento ||
          address?.municipio ||
          address?.ciudad ||
          address?.direccion
        )
        if (addressFilled && address?.departamento && address?.municipio && address?.direccion) {
          const addressResult = await createOrUpdateClientAddress(editClient.id, {
            departamento: address.departamento,
            municipio: address.municipio,
            ciudad: address.ciudad || undefined,
            direccion: address.direccion,
          })
          if (addressResult.success && addressResult.data) {
            contactUpdates.address = addressResult.data
          } else if (!addressResult.success) {
            toast.error(addressResult.error || 'Error al guardar dirección')
          }
        }

        // Save additional info only if any field is filled
        const infoFilled = !!(
          additionalInfo?.actividadComercial ||
          additionalInfo?.salario ||
          additionalInfo?.fechaIngreso ||
          additionalInfo?.fechaRetiro
        )
        if (infoFilled) {
          const infoResult = await createOrUpdateClientAdditionalInfo(editClient.id, {
            actividadComercial: additionalInfo?.actividadComercial || undefined,
            salario: additionalInfo?.salario ?? null,
            fechaIngreso: additionalInfo?.fechaIngreso || null,
            fechaRetiro: additionalInfo?.fechaRetiro || null,
          })
          if (infoResult.success && infoResult.data) {
            contactUpdates.additionalInfo = infoResult.data
          } else if (!infoResult.success) {
            toast.error(infoResult.error || 'Error al guardar información del contrato')
          }
        }

        toast.success('Cliente actualizado exitosamente')
        if (result.data) {
          onClientUpdated?.(editClient.id, result.data)
        }
        if (Object.keys(contactUpdates).length > 0) {
          onContactInfoUpdated?.(contactUpdates)
        }

        form.reset()
        onOpenChange(false)
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

        if (result.success) {
          form.reset()
          onOpenChange(false)
        }
      }
    } catch (error) {
      console.error('Submit client error:', error)
      toast.error('Error inesperado al procesar solicitud')
    } finally {
      setIsLoading(false)
    }
  }

  const availableIdTypes = isCompany ? ALL_ID_TYPES : PERSON_ID_TYPES
  const currentMask = ID_MASK_CONFIG[identificationType]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${isEditMode ? 'sm:max-w-[760px]' : 'sm:max-w-[600px]'} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Editar Cliente' : 'Crear Nuevo Cliente'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Actualiza la información del cliente, dirección e información del contrato.'
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

            {/* Employee type - only for EMPLEADO */}
            {isEmployee && (
              <FormField
                control={form.control}
                name="employeeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Empleado</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo de empleado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={EmployeeType.TIEMPO_COMPLETO}>Trabajador tiempo completo</SelectItem>
                        <SelectItem value={EmployeeType.TIEMPO_PARCIAL}>Trabajador tiempo parcial</SelectItem>
                        <SelectItem value={EmployeeType.INDEPENDIENTE_CONTRATISTA}>Independiente Contratista</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Work days range - only for TIEMPO_PARCIAL */}
            {isEmployee && isPartTime && (
              <FormField
                control={form.control}
                name="workDaysRange"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Días laborados al mes</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar rango de días" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={WorkDaysRange.DIAS_1_7}>1 a 7 días al mes</SelectItem>
                        <SelectItem value={WorkDaysRange.DIAS_8_14}>8 a 14 días al mes</SelectItem>
                        <SelectItem value={WorkDaysRange.DIAS_15_21}>15 a 21 días al mes</SelectItem>
                        <SelectItem value={WorkDaysRange.DIAS_22_30}>22 a 30 días al mes</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                      disabled={isLoading}
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

            {/* Address + Additional Info — only in edit mode (all optional) */}
            {isEditMode && (
              <>
                <Separator className="my-6" />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Dirección (Opcional)</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="address.departamento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Departamento</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value)
                              form.setValue('address.municipio', '')
                            }}
                            value={field.value || ''}
                            disabled={isLoading}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar" />
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

                    <FormField
                      control={form.control}
                      name="address.municipio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Municipio</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || ''}
                            disabled={isLoading || !addressDepartamento}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar" />
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
                  </div>

                  <FormField
                    control={form.control}
                    name="address.ciudad"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Barrio</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej: El Poblado"
                            disabled={isLoading}
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address.direccion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dirección Completa</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Ej: Calle 50 # 45-23, Apto 301"
                            className="resize-none"
                            disabled={isLoading}
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator className="my-6" />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Información del Contrato (Opcional)</h3>
                  </div>

                  <FormField
                    control={form.control}
                    name="additionalInfo.actividadComercial"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Actividad Comercial</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej: Comercio al por menor, Servicios profesionales"
                            disabled={isLoading}
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="additionalInfo.salario"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salario (COP)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="2500000"
                            disabled={isLoading}
                            value={field.value ?? ''}
                            onChange={(e) => {
                              const value = e.target.value
                              field.onChange(value ? parseFloat(value) : undefined)
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="additionalInfo.fechaIngreso"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Novedad de Ingreso</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              disabled={isLoading}
                              {...field}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="additionalInfo.fechaRetiro"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Novedad de Retiro</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              disabled={isLoading}
                              {...field}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </>
            )}

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
