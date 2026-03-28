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
import { CalendarIcon, Loader2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { updateAffiliation } from '@/lib/actions/affiliation.actions'

const processTypeOptions = [
  { value: AffiliationProcessType.DEPENDIENTE, label: '(01) Dependiente' },
  { value: AffiliationProcessType.INDEPENDIENTE, label: '(3) Independiente' },
  { value: AffiliationProcessType.TRABAJADOR_TIEMPO_PARCIAL, label: '(51) Trabajador de tiempo parcial' },
  { value: AffiliationProcessType.INDEPENDIENTE_VOLUNTARIO, label: '(57) Independiente voluntario' },
  { value: AffiliationProcessType.CONTRATISTA_INDEPENDIENTE, label: '(59) Contratista independiente' },
  { value: AffiliationProcessType.BENEFICIARIO_UPC_ADICIONAL, label: '(40) Beneficiario UPC adicional' },
  { value: AffiliationProcessType.COTIZANTE_INDEPENDIENTE_SALUD, label: '(42) Cotizante independiente pago solo salud' },
  { value: AffiliationProcessType.COTIZANTE_PENSIONES_PAGO_TERCERO, label: '(43) Cotizante a pensiones con pago por tercero' },
  { value: AffiliationProcessType.PLANILLA_S_SERVICIO_DOMESTICO, label: 'Planilla S Servicio doméstico' },
  { value: AffiliationProcessType.PLANILLA_E_EMPLEADOS, label: 'Planilla E (Empleados)' },
  { value: AffiliationProcessType.LIQUIDACIONES, label: 'Liquidaciones' },
  { value: AffiliationProcessType.TRASLADO_EPS, label: 'Traslado de EPS' },
  { value: AffiliationProcessType.COBRO_INCAPACIDADES, label: 'Cobro Incapacidades' },
  { value: AffiliationProcessType.LIQUIDACION_PLANILLA_S, label: 'Liquidacion PlanillaS' },
  { value: AffiliationProcessType.INCLUSION_BENEFICIARIOS, label: 'Inclusion Beneficiarios' },
  { value: AffiliationProcessType.ASESORIAS_PENSIONES, label: 'Asesorias y pensiones' },
  { value: AffiliationProcessType.OTRO, label: 'Otro' },
]

interface AffiliationEditDialogProps {
  affiliationId: string
  currentProcessType: AffiliationProcessType | null
  currentProcessTypeOther: string | null
  currentStartDate: Date | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AffiliationEditDialog({
  affiliationId,
  currentProcessType,
  currentProcessTypeOther,
  currentStartDate,
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

  // Reset state when dialog opens or affiliation changes
  useEffect(() => {
    if (open) {
      setProcessType(currentProcessType ?? '')
      setProcessTypeOther(currentProcessTypeOther ?? '')
      setStartDate(currentStartDate ? new Date(currentStartDate) : undefined)
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
                {processTypeOptions.map((opt) => (
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
