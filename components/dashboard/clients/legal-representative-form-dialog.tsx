'use client'

import { useState, useEffect, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { IMaskInput } from 'react-imask'
import { updateLegalRepresentative } from '@/lib/actions'
import { legalRepresentativeSchema, type LegalRepresentativeInput } from '@/lib/validations/client.schema'
import type { LegalRepresentative } from '@/lib/types/client.types'
import { IdentificationType } from '@prisma/client'
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

const PHONE_MASK = '+57 000 000 0000'
const PHONE_PLACEHOLDER = '+57 300 123 4567'

interface LegalRepresentativeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  initialData?: LegalRepresentative | null
  onUpdated: (data: LegalRepresentative) => void
}

export function LegalRepresentativeFormDialog({
  open,
  onOpenChange,
  clientId,
  initialData,
  onUpdated,
}: LegalRepresentativeFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const prevIdTypeRef = useRef<IdentificationType | null>(null)

  const form = useForm<LegalRepresentativeInput>({
    resolver: zodResolver(legalRepresentativeSchema),
    mode: 'onBlur',
    defaultValues: {
      fullName: initialData?.fullName ?? '',
      identificationType: initialData?.identificationType ?? IdentificationType.CEDULA,
      identificationNumber: initialData?.identificationNumber ?? '',
      email: initialData?.email ?? '',
      phone: initialData?.phone ?? '',
    },
  })

  const identificationType = form.watch('identificationType')

  useEffect(() => {
    if (open) {
      form.reset({
        fullName: initialData?.fullName ?? '',
        identificationType: initialData?.identificationType ?? IdentificationType.CEDULA,
        identificationNumber: initialData?.identificationNumber ?? '',
        email: initialData?.email ?? '',
        phone: initialData?.phone ?? '',
      })
      prevIdTypeRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (prevIdTypeRef.current !== null && prevIdTypeRef.current !== identificationType) {
      form.setValue('identificationNumber', '')
    }
    prevIdTypeRef.current = identificationType
  }, [identificationType, form])

  const currentMask = ID_MASK_CONFIG[identificationType] ?? ID_MASK_CONFIG.CEDULA

  async function onSubmit(data: LegalRepresentativeInput) {
    setIsLoading(true)
    try {
      const result = await updateLegalRepresentative(clientId, data)
      if (result.success && result.data) {
        toast.success(result.message || 'Representante legal actualizado exitosamente')
        onUpdated(result.data)
        onOpenChange(false)
      } else {
        toast.error(result.error || 'Error al actualizar representante legal')
      }
    } catch (error) {
      console.error('Update legal representative error:', error)
      toast.error('Error inesperado al actualizar representante legal')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Representante Legal</DialogTitle>
          <DialogDescription>
            Actualiza la información del representante legal de la empresa
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre Completo</FormLabel>
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
                render={() => (
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
                            value={value ?? ''}
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

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="representante@ejemplo.com"
                      type="email"
                      disabled={isLoading}
                      {...field}
                      value={field.value ?? ''}
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

            <FormField
              control={form.control}
              name="phone"
              render={() => (
                <FormItem>
                  <FormLabel>Teléfono (Opcional)</FormLabel>
                  <FormControl>
                    <Controller
                      control={form.control}
                      name="phone"
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

            <div className="flex justify-end space-x-2 pt-2">
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
                Guardar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
