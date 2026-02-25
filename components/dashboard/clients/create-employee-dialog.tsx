'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { IMaskInput } from 'react-imask'
import { createClient, assignEmployeeToCompany } from '@/lib/actions'
import { createEmployeeSchema, type CreateEmployeeInput } from '@/lib/validations/client.schema'
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

// ID types allowed for employees (natural persons)
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

interface CreateEmployeeDialogProps {
  companyId: string
  isOpen: boolean
  onClose: () => void
  onEmployeeCreated: (employee: SafeClient) => void
}

export function CreateEmployeeDialog({
  companyId,
  isOpen,
  onClose,
  onEmployeeCreated,
}: CreateEmployeeDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<CreateEmployeeInput>({
    resolver: zodResolver(createEmployeeSchema),
    mode: 'onBlur',
    defaultValues: {
      fullName: '',
      clientType: ClientType.EMPLEADO,
      identificationType: IdentificationType.CEDULA,
      identificationNumber: '',
      email: '',
      phone: '',
    },
  })

  const identificationType = form.watch('identificationType')
  const currentMask = ID_MASK_CONFIG[identificationType]

  // Track previous identification type to clear number only when it actually changes
  const prevIdTypeRef = useRef<IdentificationType | null>(null)

  // Clear identification number when type changes (mask format changes), but not on initial mount
  useEffect(() => {
    if (prevIdTypeRef.current !== null && prevIdTypeRef.current !== identificationType) {
      form.setValue('identificationNumber', '')
    }
    prevIdTypeRef.current = identificationType
  }, [identificationType, form])

  async function onSubmit(data: CreateEmployeeInput) {
    setIsLoading(true)

    try {
      // Create the employee
      const createResult = await createClient(data)

      if (!createResult.success || !createResult.data) {
        toast.error(createResult.error || 'Error al crear empleado')
        setIsLoading(false)
        return
      }

      const newEmployee = createResult.data

      // Assign the employee to the company
      const assignResult = await assignEmployeeToCompany(newEmployee.id, companyId)

      if (!assignResult.success) {
        toast.error(assignResult.error || 'Empleado creado pero no pudo ser asignado a la empresa')
        setIsLoading(false)
        return
      }

      toast.success('Empleado creado y asignado exitosamente')
      onEmployeeCreated(newEmployee)
      form.reset()
      onClose()

      // Redirect to employee detail
      router.push(`/dashboard/clients/${newEmployee.id}`)
    } catch (error) {
      console.error('Create employee error:', error)
      toast.error('Error inesperado al crear empleado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      form.reset()
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Empleado</DialogTitle>
          <DialogDescription>
            Crea un nuevo empleado y asígnalo automáticamente a esta empresa
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Full Name */}
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Juan Pérez García" disabled={isLoading} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Identification Type and Number */}
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
                      placeholder="empleado@ejemplo.com"
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

            {/* Client Type (hidden, always EMPLEADO) */}
            <input type="hidden" {...form.register('clientType')} value={ClientType.EMPLEADO} />

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Empleado
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
