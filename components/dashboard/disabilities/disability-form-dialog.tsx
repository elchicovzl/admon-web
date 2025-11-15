'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { createDisability, updateDisability, getClients } from '@/lib/actions'
import { createDisabilitySchema, type CreateDisabilityInput } from '@/lib/validations/disability.schema'
import type { SafeDisability } from '@/lib/types/disability.types'
import type { SafeClient } from '@/lib/types/client.types'
import { DisabilityStatus, HealthAdministrator } from '@prisma/client'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface DisabilityFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDisabilityCreated?: (disability: SafeDisability) => void
  onDisabilityUpdated?: (disabilityId: string, updates: Partial<SafeDisability>) => void
  editDisability?: SafeDisability | null
}

const statusOptions = [
  { value: DisabilityStatus.NOT_STARTED, label: 'Por Iniciar' },
  { value: DisabilityStatus.IN_PROGRESS, label: 'En Proceso' },
  { value: DisabilityStatus.COMPLETED, label: 'Terminado' },
  { value: DisabilityStatus.CLOSED, label: 'Cerrado' },
  { value: DisabilityStatus.URGENT, label: 'Urgente' },
]

const administratorOptions = [
  { value: HealthAdministrator.EPS_SURA, label: 'EPS SURA' },
  { value: HealthAdministrator.PORVENIR, label: 'PORVENIR' },
  { value: HealthAdministrator.NUEVA_EPS, label: 'NUEVA EPS' },
  { value: HealthAdministrator.ARL_SURA, label: 'ARL SURA' },
  { value: HealthAdministrator.SALUD_TOTAL, label: 'SALUD TOTAL' },
  { value: HealthAdministrator.SAVIA_SALUD, label: 'SAVIA SALUD' },
]

export function DisabilityFormDialog({
  open,
  onOpenChange,
  onDisabilityCreated,
  onDisabilityUpdated,
  editDisability,
}: DisabilityFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [clients, setClients] = useState<SafeClient[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const isEditMode = !!editDisability

  const form = useForm<CreateDisabilityInput>({
    resolver: zodResolver(createDisabilitySchema),
    defaultValues: {
      receptionDate: new Date(),
      status: DisabilityStatus.NOT_STARTED,
      clientId: '',
      employeeId: '',
      administrator: HealthAdministrator.EPS_SURA,
      startDate: new Date(),
      endDate: new Date(),
      bankRegistry: false,
      transcription: '',
      filing: '',
      proofFileUrl: '',
    },
  })

  // Load clients on mount
  useEffect(() => {
    async function loadClients() {
      try {
        const result = await getClients()
        if (result.success && result.data) {
          setClients(result.data.filter((c) => c.isActive))
        }
      } catch (error) {
        console.error('Error loading clients:', error)
        toast.error('Error al cargar clientes')
      } finally {
        setLoadingClients(false)
      }
    }

    if (open) {
      loadClients()
    }
  }, [open])

  // Update form when editDisability changes
  useEffect(() => {
    if (editDisability) {
      form.reset({
        receptionDate: new Date(editDisability.receptionDate),
        status: editDisability.status,
        clientId: editDisability.clientId,
        employeeId: editDisability.employeeId,
        administrator: editDisability.administrator,
        startDate: new Date(editDisability.startDate),
        endDate: new Date(editDisability.endDate),
        bankRegistry: editDisability.bankRegistry,
        transcription: editDisability.transcription,
        filing: editDisability.filing,
        proofFileUrl: editDisability.proofFileUrl || '',
      })
    } else {
      form.reset({
        receptionDate: new Date(),
        status: DisabilityStatus.NOT_STARTED,
        clientId: '',
        employeeId: '',
        administrator: HealthAdministrator.EPS_SURA,
        startDate: new Date(),
        endDate: new Date(),
        bankRegistry: false,
        transcription: '',
        filing: '',
        proofFileUrl: '',
      })
    }
  }, [editDisability, form])

  async function onSubmit(data: CreateDisabilityInput) {
    setIsLoading(true)

    try {
      let result

      if (isEditMode && editDisability) {
        result = await updateDisability(editDisability.id, data)

        if (result.success) {
          toast.success(result.message || 'Incapacidad actualizada exitosamente')
          if (result.data) {
            onDisabilityUpdated?.(editDisability.id, result.data)
          }
        } else {
          toast.error(result.error || 'Error al actualizar incapacidad')
        }
      } else {
        result = await createDisability(data)

        if (result.success) {
          toast.success(result.message || 'Incapacidad creada exitosamente')
          if (result.data) {
            onDisabilityCreated?.(result.data)
          }
        } else {
          toast.error(result.error || 'Error al crear incapacidad')
        }
      }

      if (result.success) {
        form.reset()
        onOpenChange(false)
      }
    } catch (error) {
      console.error('Submit disability error:', error)
      toast.error('Error inesperado al procesar solicitud')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Editar Incapacidad' : 'Crear Nueva Incapacidad'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Actualiza la información de la incapacidad.'
              : 'Completa todos los campos requeridos para crear una nueva incapacidad.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Fecha Recepción */}
              <FormField
                control={form.control}
                name="receptionDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha de Recepción</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP', { locale: es })
                            ) : (
                              <span>Seleccionar fecha</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Cliente */}
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={loadingClients}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar cliente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Empleado */}
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empleado</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={loadingClients}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar empleado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Administradora */}
            <FormField
              control={form.control}
              name="administrator"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Administradora</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar administradora" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {administratorOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* Fecha Inicio */}
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha de Inicio</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP', { locale: es })
                            ) : (
                              <span>Seleccionar fecha</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date('1900-01-01')}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Fecha Fin */}
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha de Finalización</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP', { locale: es })
                            ) : (
                              <span>Seleccionar fecha</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date('1900-01-01')}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Registro Banco */}
            <FormField
              control={form.control}
              name="bankRegistry"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Registro Banco</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {/* Transcripción */}
            <FormField
              control={form.control}
              name="transcription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transcripción</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ingrese la transcripción..."
                      className="min-h-[100px]"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Radicación */}
            <FormField
              control={form.control}
              name="filing"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Radicación</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ingrese la radicación..."
                      className="min-h-[100px]"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Comprobante URL */}
            <FormField
              control={form.control}
              name="proofFileUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL del Comprobante (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://ejemplo.com/comprobante.pdf"
                      disabled={isLoading}
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                {isEditMode ? 'Actualizar' : 'Crear Incapacidad'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
