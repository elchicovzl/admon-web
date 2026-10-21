'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateAiLimitSettings } from '@/lib/actions/whatsapp.actions'
import type { AiLimitSettings } from '@/lib/types/whatsapp.types'

interface WhatsAppAiLimitsFormProps {
  initial: AiLimitSettings
}

const usdFormat = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

const toField = (value: number | null) => (value === null ? '' : String(value))

/** Empty means "not set"; anything else is sent as a number and validated by the action. */
const toNumber = (value: string) => (value.trim() === '' ? null : Number(value.replace(',', '.')))

/**
 * AI cost and abuse limits (SUPER_ADMIN). Empty fields use the server value; an empty daily
 * budget means no global cap. Saved values apply to the next AI turn, without a deploy.
 */
export function WhatsAppAiLimitsForm({ initial }: WhatsAppAiLimitsFormProps) {
  const { saved, server } = initial
  const [dailyBudgetUsd, setDailyBudgetUsd] = useState(toField(saved.dailyBudgetUsd))
  const [maxTurnsPerDay, setMaxTurnsPerDay] = useState(toField(saved.maxTurnsPerDay))
  const [maxConsecutiveFailures, setMaxConsecutiveFailures] = useState(toField(saved.maxConsecutiveFailures))
  const [forbiddenTopics, setForbiddenTopics] = useState(saved.forbiddenTopics.join('\n'))
  const [pending, startTransition] = useTransition()

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    startTransition(async () => {
      const result = await updateAiLimitSettings({
        dailyBudgetUsd: toNumber(dailyBudgetUsd),
        maxTurnsPerDay: toNumber(maxTurnsPerDay),
        maxConsecutiveFailures: toNumber(maxConsecutiveFailures),
        forbiddenTopics: forbiddenTopics.split('\n'),
      })
      if (!result.success) {
        toast.error(result.error ?? 'No se pudieron guardar los límites')
        return
      }
      toast.success(result.message ?? 'Límites de IA guardados')
    })
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>WhatsApp: límites de la IA</CardTitle>
        <CardDescription>
          Controlan el gasto y el abuso del asistente. Un campo vacío usa el valor del servidor. Los cambios
          aplican desde la siguiente respuesta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="ai-daily-budget">Tope de gasto diario (USD)</Label>
            <Input
              id="ai-daily-budget"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              placeholder="Sin tope"
              value={dailyBudgetUsd}
              onChange={(event) => setDailyBudgetUsd(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Gasto estimado de hoy (hora de Colombia): {usdFormat.format(initial.spentTodayUsd)}. Al llegar al tope, la IA
              deja de responder y pasa las conversaciones a un asesor hasta el día siguiente.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-max-turns">Respuestas de IA por número por día</Label>
              <Input
                id="ai-max-turns"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                placeholder={`Servidor: ${server.maxTurnsPerDay}`}
                value={maxTurnsPerDay}
                onChange={(event) => setMaxTurnsPerDay(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">Al llegar al límite, la conversación pasa a un asesor.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-max-failures">Fallas seguidas antes de escalar</Label>
              <Input
                id="ai-max-failures"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                placeholder={`Servidor: ${server.maxConsecutiveFailures}`}
                value={maxConsecutiveFailures}
                onChange={(event) => setMaxConsecutiveFailures(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">Respuestas sin sustento seguidas.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-forbidden-topics">Temas prohibidos</Label>
            <Textarea
              id="ai-forbidden-topics"
              rows={4}
              placeholder={'Un tema por línea, por ejemplo:\ncriptomonedas\ndemanda laboral'}
              value={forbiddenTopics}
              onChange={(event) => setForbiddenTopics(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Si un mensaje menciona uno, pasa directo a un asesor, sin consultar a la IA.
              {server.forbiddenTopics.length > 0 && ` Del servidor (siempre activos): ${server.forbiddenTopics.join(', ')}.`}
            </p>
          </div>

          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Las notas de voz no se transcriben en conversaciones escaladas, ni en las que atiende la IA cuando
            llegaron a su límite diario o se alcanzó el tope de gasto. Las que atiende un asesor siempre se transcriben.
          </p>

          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar límites
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
