'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { toast } from 'sonner'
import { NovedadType, NovedadUnit } from '@prisma/client'
import type { DateRange } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { createNovedad, updateNovedad } from '@/lib/actions'
import {
  createNovedadSchema,
  type CreateNovedadInput,
} from '@/lib/validations/novedad.schema'
import { computeVacationDeduction } from '@/lib/utils/novedad-balance'
import type { NovedadListItem, NovedadUserRef } from '@/lib/types/novedad.types'
import {
  NOVEDAD_TYPE_LABELS,
  NOVEDAD_UNIT_LABELS,
} from '@/components/dashboard/novedades/novedad-meta'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { SearchableSelect } from '@/components/ui/searchable-select'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface NovedadFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: NovedadUserRef[]
  editNovedad?: NovedadListItem | null
  /** Pre-selecciona y bloquea el empleado (vista de un solo empleado). */
  lockedUserId?: string
  onSaved?: () => void
}

/** Unidad por defecto según el tipo de novedad. */
function defaultUnitFor(type: NovedadType): NovedadUnit {
  return type === NovedadType.PERMISO ? NovedadUnit.HORAS : NovedadUnit.DIAS
}

export function NovedadFormDialog({
  open,
  onOpenChange,
  employees,
  editNovedad,
  lockedUserId,
  onSaved,
}: NovedadFormDialogProps) {
  const isEditMode = !!editNovedad
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<CreateNovedadInput>({
    resolver: zodResolver(createNovedadSchema),
    defaultValues: {
      userId: lockedUserId ?? '',
      type: NovedadType.VACACIONES,
      unit: NovedadUnit.DIAS,
      startDate: new Date(),
      endDate: new Date(),
      hours: null,
      observation: '',
    },
  })

  // Sincroniza el formulario al abrir / cambiar de registro a editar.
  useEffect(() => {
    if (!open) return
    if (editNovedad) {
      form.reset({
        userId: editNovedad.user.id,
        type: editNovedad.type,
        unit: editNovedad.unit,
        startDate: new Date(editNovedad.startDate),
        endDate: new Date(editNovedad.endDate),
        hours: editNovedad.hours,
        observation: editNovedad.observation ?? '',
      })
    } else {
      form.reset({
        userId: lockedUserId ?? '',
        type: NovedadType.VACACIONES,
        unit: NovedadUnit.DIAS,
        startDate: new Date(),
        endDate: new Date(),
        hours: null,
        observation: '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editNovedad, lockedUserId])

  const watchedType = form.watch('type')
  const watchedUnit = form.watch('unit')
  const watchedStart = form.watch('startDate')
  const watchedEnd = form.watch('endDate')
  const watchedHours = form.watch('hours')

  const isHourUnit = watchedUnit === NovedadUnit.HORAS

  // Preview del descuento de vacaciones según las reglas de negocio.
  const previewDeduction =
    watchedStart && watchedEnd
      ? computeVacationDeduction({
          type: watchedType,
          startDate: watchedStart,
          endDate: watchedEnd,
          hours: watchedHours,
        })
      : 0

  async function onSubmit(values: CreateNovedadInput) {
    setIsLoading(true)
    try {
      const payload: CreateNovedadInput = {
        ...values,
        hours: values.unit === NovedadUnit.HORAS ? values.hours : null,
        observation: values.observation?.trim() || null,
      }

      const result = isEditMode
        ? await updateNovedad(editNovedad!.id, { ...payload, id: editNovedad!.id })
        : await createNovedad(payload)

      if (result.success) {
        toast.success(result.message || 'Novedad guardada')
        onSaved?.()
        onOpenChange(false)
      } else {
        toast.error(result.error || 'Error al guardar la novedad')
      }
    } catch {
      toast.error('Error inesperado al guardar la novedad')
    } finally {
      setIsLoading(false)
    }
  }

  const employeeOptions = employees.map((e) => ({
    value: e.id,
    label: e.name || e.email,
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Editar novedad' : 'Registrar novedad'}</DialogTitle>
          <DialogDescription>
            Vacaciones, permisos o calamidades. Los días de vacaciones se calculan
            en hábiles (sin fines de semana ni festivos).
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Empleado */}
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empleado</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={employeeOptions}
                      value={field.value || null}
                      onValueChange={(v) => field.onChange(v ?? '')}
                      placeholder="Seleccionar empleado"
                      searchPlaceholder="Buscar empleado..."
                      disabled={!!lockedUserId}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* Tipo */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value)
                        form.setValue('unit', defaultUnitFor(value as NovedadType))
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(NovedadType).map((t) => (
                          <SelectItem key={t} value={t}>
                            {NOVEDAD_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Unidad */}
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidad</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={watchedType === NovedadType.VACACIONES}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Unidad" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(NovedadUnit).map((u) => (
                          <SelectItem key={u} value={u}>
                            {NOVEDAD_UNIT_LABELS[u]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Período (un solo selector de rango) */}
            <FormField
              control={form.control}
              name="startDate"
              render={() => {
                const range: DateRange | undefined = watchedStart
                  ? { from: watchedStart, to: watchedEnd ?? watchedStart }
                  : undefined
                const sameDay =
                  watchedStart &&
                  watchedEnd &&
                  watchedStart.getTime() === watchedEnd.getTime()
                return (
                  <FormItem className="flex flex-col">
                    <FormLabel>Período</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'pl-3 text-left font-normal',
                              !watchedStart && 'text-muted-foreground'
                            )}
                          >
                            {watchedStart
                              ? sameDay
                                ? format(watchedStart, 'dd/MM/yyyy', { locale: es })
                                : `${format(watchedStart, 'dd/MM/yyyy', {
                                    locale: es,
                                  })} → ${format(watchedEnd!, 'dd/MM/yyyy', {
                                    locale: es,
                                  })}`
                              : 'Seleccionar período'}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          numberOfMonths={2}
                          selected={range}
                          onSelect={(r) => {
                            form.setValue('startDate', (r?.from ?? undefined) as Date, {
                              shouldValidate: true,
                            })
                            form.setValue(
                              'endDate',
                              (r?.to ?? r?.from ?? undefined) as Date,
                              { shouldValidate: true }
                            )
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />

            {/* Horas (solo cuando la unidad es HORAS) */}
            {isHourUnit && (
              <FormField
                control={form.control}
                name="hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horas</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0.5}
                        max={24}
                        step={0.5}
                        placeholder="Ej: 4"
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Observación */}
            <FormField
              control={form.control}
              name="observation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observación</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notas u observaciones (opcional)"
                      className="resize-none"
                      rows={3}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Preview del descuento */}
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {previewDeduction > 0 ? (
                <span>
                  Se descontará{previewDeduction === 1 ? '' : 'n'}{' '}
                  <span className="font-semibold">{previewDeduction}</span> día
                  {previewDeduction === 1 ? '' : 's'} de vacaciones.
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Este registro no descuenta días de vacaciones.
                </span>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Guardando...' : isEditMode ? 'Guardar cambios' : 'Registrar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
