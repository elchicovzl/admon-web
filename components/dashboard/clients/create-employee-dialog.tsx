'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient, assignEmployeeToCompany } from '@/lib/actions'
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

  const form = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      fullName: '',
      identificationType: IdentificationType.CEDULA,
      identificationNumber: '',
      clientType: ClientType.EMPLEADO, // Fixed to EMPLEADO
      email: '',
      phone: '',
      status: 'ACTIVO',
    },
  })

  async function onSubmit(data: CreateClientInput) {
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
      <DialogContent className="sm:max-w-[600px]">
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
                    <Input placeholder="Juan Pérez" {...field} />
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un tipo" />
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
                name="identificationNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl>
                      <Input placeholder="1234567890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Email and Phone */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="empleado@ejemplo.com" {...field} />
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
                      <Input placeholder="3001234567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Status (hidden, always ACTIVO) */}
            <input type="hidden" {...form.register('status')} value="ACTIVO" />

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
