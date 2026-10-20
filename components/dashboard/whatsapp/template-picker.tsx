'use client'

import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TEMPLATE_PARAM_MAX_LENGTH,
  renderTemplateBody,
  suggestedFirstName,
  validateTemplateParams,
  type TemplateKey,
  type TemplateOption,
} from '@/lib/whatsapp/templates'

interface TemplatePickerProps {
  templates: TemplateOption[]
  /** Used to prefill {{1}} with the customer's first name. */
  displayName: string
  sending: boolean
  /** Resolves true when the template was queued, so the form can reset. */
  onSend: (key: TemplateKey, params: string[]) => Promise<boolean>
}

/** Approved templates with one input per variable and a live preview of the message (WI-6, WI-10). */
export function TemplatePicker({ templates, displayName, sending, onSend }: TemplatePickerProps) {
  const [key, setKey] = useState<TemplateKey | ''>('')
  const [values, setValues] = useState<string[]>([])

  const selected = templates.find((template) => template.key === key) ?? null

  const choose = (next: string) => {
    const template = templates.find((item) => item.key === next)
    if (!template) return
    setKey(template.key)
    setValues(template.paramLabels.map((_, index) => (index === 0 ? suggestedFirstName(displayName) : '')))
  }

  const check = selected ? validateTemplateParams(selected.key, values) : null
  const ready = selected !== null && check?.ok === true

  const submit = async () => {
    if (!selected || !check?.ok) return
    const sent = await onSend(selected.key, check.params)
    if (sent) {
      setKey('')
      setValues([])
    }
  }

  if (templates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay plantillas aprobadas disponibles. Cuando la ventana esté cerrada solo se pueden enviar plantillas
        aprobadas por Meta.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <Select value={key} onValueChange={choose} disabled={sending}>
        <SelectTrigger aria-label="Plantilla">
          <SelectValue placeholder="Elija una plantilla" />
        </SelectTrigger>
        <SelectContent>
          {templates.map((template) => (
            <SelectItem key={template.key} value={template.key}>
              {template.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {selected.paramLabels.map((label, index) => (
              <div key={label} className="space-y-1">
                <Label htmlFor={`template-param-${index}`} className="text-xs">
                  {label}
                </Label>
                <Input
                  id={`template-param-${index}`}
                  value={values[index] ?? ''}
                  maxLength={TEMPLATE_PARAM_MAX_LENGTH}
                  disabled={sending}
                  onChange={(event) =>
                    setValues((current) => current.map((value, i) => (i === index ? event.target.value : value)))
                  }
                />
              </div>
            ))}
          </div>
          <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
            {renderTemplateBody(selected.key, values.map((value) => value.trim() || '…'))}
          </p>
          {check && !check.ok && values.some((value) => value.trim()) && (
            <p className="text-xs text-destructive">{check.error}</p>
          )}
          <Button type="button" size="sm" disabled={!ready || sending} onClick={() => void submit()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar plantilla
          </Button>
        </>
      )}
    </div>
  )
}
