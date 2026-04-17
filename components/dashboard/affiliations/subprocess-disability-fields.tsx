'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { updateSubProcessDisabilityFields } from '@/lib/actions/affiliation.actions'

interface DisabilityFields {
  disabilityStartDate: Date | null
  disabilityEndDate: Date | null
  bankRegistry: boolean
  transcription: boolean
  collection: boolean
}

interface Props {
  subProcessId: string
  initial: DisabilityFields
  onUpdated?: (fields: DisabilityFields) => void
}

export function SubProcessDisabilityFields({ subProcessId, initial, onUpdated }: Props) {
  const [fields, setFields] = useState<DisabilityFields>(initial)
  const [isPending, startTransition] = useTransition()

  const dirty =
    fields.disabilityStartDate?.getTime() !== initial.disabilityStartDate?.getTime() ||
    fields.disabilityEndDate?.getTime() !== initial.disabilityEndDate?.getTime() ||
    fields.bankRegistry !== initial.bankRegistry ||
    fields.transcription !== initial.transcription ||
    fields.collection !== initial.collection

  const days =
    fields.disabilityStartDate && fields.disabilityEndDate
      ? Math.max(
          1,
          Math.round(
            (fields.disabilityEndDate.getTime() - fields.disabilityStartDate.getTime()) /
              (1000 * 60 * 60 * 24)
          ) + 1
        )
      : null

  function handleSave() {
    startTransition(async () => {
      const result = await updateSubProcessDisabilityFields({
        subProcessId,
        disabilityStartDate: fields.disabilityStartDate,
        disabilityEndDate: fields.disabilityEndDate,
        bankRegistry: fields.bankRegistry,
        transcription: fields.transcription,
        collection: fields.collection,
      })
      if (result.success) {
        toast.success('Campos de incapacidad guardados')
        onUpdated?.(fields)
      } else {
        toast.error(result.error || 'Error al guardar')
      }
    })
  }

  return (
    <Card className="border-rose-200 bg-rose-50/30">
      <CardHeader>
        <CardTitle className="text-lg text-rose-900">Datos de la Incapacidad</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium">Fecha inicio</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    'w-full justify-start text-left font-normal mt-1',
                    !fields.disabilityStartDate && 'text-muted-foreground'
                  )}
                >
                  {fields.disabilityStartDate
                    ? format(fields.disabilityStartDate, 'd MMM yyyy', { locale: es })
                    : 'Seleccionar...'}
                  <CalendarIcon className="ml-auto h-3 w-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fields.disabilityStartDate ?? undefined}
                  onSelect={(d) => setFields((p) => ({ ...p, disabilityStartDate: d ?? null }))}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="text-xs font-medium">Fecha fin</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    'w-full justify-start text-left font-normal mt-1',
                    !fields.disabilityEndDate && 'text-muted-foreground'
                  )}
                >
                  {fields.disabilityEndDate
                    ? format(fields.disabilityEndDate, 'd MMM yyyy', { locale: es })
                    : 'Seleccionar...'}
                  <CalendarIcon className="ml-auto h-3 w-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fields.disabilityEndDate ?? undefined}
                  onSelect={(d) => setFields((p) => ({ ...p, disabilityEndDate: d ?? null }))}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {days !== null && (
          <p className="text-sm text-rose-900">
            <strong>{days}</strong> {days === 1 ? 'día' : 'días'} de incapacidad
          </p>
        )}

        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={fields.bankRegistry}
              onCheckedChange={(v) => setFields((p) => ({ ...p, bankRegistry: !!v }))}
            />
            Registro de banco
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={fields.transcription}
              onCheckedChange={(v) => setFields((p) => ({ ...p, transcription: !!v }))}
            />
            Transcripción
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={fields.collection}
              onCheckedChange={(v) => setFields((p) => ({ ...p, collection: !!v }))}
            />
            Cobro
          </label>
        </div>

        {dirty && (
          <Button onClick={handleSave} disabled={isPending} size="sm" className="w-full">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Guardar cambios
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
