/**
 * Affiliation Edit Dialog
 * Edit process type and start date of an affiliation
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AffiliationProcessType } from '@prisma/client'
import { AffiliationProcessTypeOptions } from '@/lib/types/affiliation.types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CalendarIcon, Loader2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { updateAffiliation } from '@/lib/actions/affiliation.actions'

interface AffiliationEditDialogProps {
  affiliationId: string
  currentProcessType: AffiliationProcessType | null
  currentProcessTypeOther: string | null
  currentStartDate: Date | null
  currentNote?: string | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AffiliationEditDialog({
  affiliationId,
  currentProcessType,
  currentProcessTypeOther,
  currentStartDate,
  currentNote,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: AffiliationEditDialogProps) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (controlledOnOpenChange ?? setInternalOpen) : setInternalOpen

  const [processType, setProcessType] = useState<AffiliationProcessType | ''>(currentProcessType ?? '')
  const [processTypeOther, setProcessTypeOther] = useState(currentProcessTypeOther ?? '')
  const [startDate, setStartDate] = useState<Date | undefined>(
    currentStartDate ? new Date(currentStartDate) : undefined
  )
  const [note, setNote] = useState(currentNote ?? '')

  // Reset state when dialog opens or affiliation changes
  useEffect(() => {
    if (open) {
      setProcessType(currentProcessType ?? '')
      setProcessTypeOther(currentProcessTypeOther ?? '')
      setStartDate(currentStartDate ? new Date(currentStartDate) : undefined)
      setNote(currentNote ?? '')
    }
  }, [open, affiliationId])

  async function handleSave() {
    if (!processType) {
      toast.error('Debe seleccionar el tipo de proceso')
      return
    }

    if (processType === AffiliationProcessType.OTRO && processTypeOther.trim().length < 2) {
      toast.error('Debe especificar el tipo de proceso')
      return
    }

    setLoading(true)
    try {
      const result = await updateAffiliation(affiliationId, {
        processType,
        processTypeOther: processType === AffiliationProcessType.OTRO ? processTypeOther : null,
        startDate: startDate ?? null,
        note: note.trim() ? note.trim() : null,
      })

      if (result.success) {
        toast.success('Proceso actualizado')
        setOpen(false)
        window.location.reload()
      } else {
        toast.error(result.error || 'Error al actualizar')
      }
    } catch (error) {
      console.error('Error updating affiliation:', error)
      toast.error('Error al actualizar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Editar Proceso</DialogTitle>
          <DialogDescription>
            Modifica el tipo de proceso y la fecha de inicio
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Process Type */}
          <div className="space-y-2">
            <Label>Tipo de Proceso</Label>
            <Select value={processType} onValueChange={(v) => setProcessType(v as AffiliationProcessType)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo..." />
              </SelectTrigger>
              <SelectContent>
                {AffiliationProcessTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Process Type Other */}
          {processType === AffiliationProcessType.OTRO && (
            <div className="space-y-2">
              <Label>Especificar tipo de proceso</Label>
              <Input
                placeholder="Describe el tipo de proceso..."
                value={processTypeOther}
                onChange={(e) => setProcessTypeOther(e.target.value)}
              />
            </div>
          )}

          {/* Start Date */}
          <div className="space-y-2">
            <Label>Fecha de Inicio</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !startDate && 'text-muted-foreground'
                  )}
                >
                  {startDate
                    ? format(startDate, "d 'de' MMMM, yyyy", { locale: es })
                    : 'Seleccionar fecha...'}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => setStartDate(date ?? undefined)}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Fecha en la que inicia el proceso
            </p>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label>Nota</Label>
            <Textarea
              placeholder="Agregá cualquier nota relevante sobre este proceso..."
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Visible en la vista del proceso
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
