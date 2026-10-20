'use client'

import { useEffect, useState } from 'react'
import { IdentificationType } from '@prisma/client'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { LeadListItem } from '@/lib/types/lead.types'
import { LEAD_NOTES_MAX_LENGTH } from '@/lib/whatsapp/leads'

const ID_TYPE_LABEL: Record<IdentificationType, string> = {
  CEDULA: 'Cédula de Ciudadanía (CC)',
  TARJETA_IDENTIDAD: 'Tarjeta de Identidad (TI)',
  REGISTRO_CIVIL: 'Registro Civil (RC)',
  CEDULA_EXTRANJERIA: 'Cédula de Extranjería (CE)',
  PASAPORTE: 'Pasaporte (PA)',
  PPT: 'Permiso de Protección Temporal (PPT)',
  PEP: 'Permiso Especial de Permanencia (PEP)',
  NUIP: 'NUIP',
  SALVOCONDUCTO: 'Salvoconducto',
  NIT: 'NIT',
}
const NO_ID_TYPE = 'none'

export interface LeadDetails {
  fullName: string
  identificationType: IdentificationType | null
  identificationNumber: string
  email: string
  notes: string
}

interface LeadEditDialogProps {
  lead: LeadListItem | null
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSave: (details: LeadDetails) => Promise<boolean>
}

/** Details a manager collects before converting a lead. Blank fields are stored as empty. */
export function LeadEditDialog({ lead, pending, onOpenChange, onSave }: LeadEditDialogProps) {
  const [details, setDetails] = useState<LeadDetails>({
    fullName: '',
    identificationType: null,
    identificationNumber: '',
    email: '',
    notes: '',
  })

  useEffect(() => {
    if (!lead) return
    setDetails({
      fullName: lead.fullName ?? lead.displayName ?? '',
      identificationType: lead.identificationType,
      identificationNumber: lead.identificationNumber ?? '',
      email: lead.email ?? '',
      notes: lead.notes ?? '',
    })
  }, [lead])

  const set = <K extends keyof LeadDetails>(key: K, value: LeadDetails[K]) =>
    setDetails((current) => ({ ...current, [key]: value }))

  const submit = async () => {
    if (await onSave(details)) onOpenChange(false)
  }

  return (
    <Dialog open={lead !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar lead</DialogTitle>
          <DialogDescription>{lead?.phoneE164}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="lead-name">Nombre completo</Label>
            <Input id="lead-name" value={details.fullName} onChange={(e) => set('fullName', e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de documento</Label>
              <Select
                value={details.identificationType ?? NO_ID_TYPE}
                onValueChange={(value) =>
                  set('identificationType', value === NO_ID_TYPE ? null : (value as IdentificationType))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ID_TYPE}>Sin definir</SelectItem>
                  {Object.entries(ID_TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-id">Número de documento</Label>
              <Input
                id="lead-id"
                value={details.identificationNumber}
                onChange={(e) => set('identificationNumber', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-email">Correo</Label>
            <Input id="lead-email" type="email" value={details.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-notes">Notas</Label>
            <Textarea
              id="lead-notes"
              value={details.notes}
              maxLength={LEAD_NOTES_MAX_LENGTH}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={pending} onClick={() => void submit()}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
