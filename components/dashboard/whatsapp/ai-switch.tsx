'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { setAiEnabled } from '@/lib/actions/whatsapp.actions'
import type { AiSettings } from '@/lib/types/whatsapp.types'

interface AiSwitchProps {
  initial: AiSettings
}

function statusText(settings: AiSettings): string {
  const base = settings.aiEnabled ? 'IA encendida' : 'IA apagada'
  return settings.envEnabled ? base : `${base} (desactivada en el servidor)`
}

/**
 * Global AI switch (AI-12). Only a SUPER_ADMIN can flip it; everyone else sees the state.
 * Turning it off is immediate; turning it on asks first, because the assistant then answers
 * every conversation that is not paused.
 */
export function AiSwitch({ initial }: AiSwitchProps) {
  const [settings, setSettings] = useState(initial)
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  const apply = (enabled: boolean) => {
    startTransition(async () => {
      const result = await setAiEnabled({ enabled })
      if (!result.success || !result.data) {
        toast.error(result.error ?? 'No se pudo cambiar la IA')
        return
      }
      setSettings(result.data)
      toast.success(enabled ? 'IA encendida' : 'IA apagada')
    })
  }

  return (
    <>
      <div
        className="flex items-center gap-2 rounded-md border px-3 py-1.5"
        title={settings.envEnabled ? undefined : 'WHATSAPP_AI_ENABLED no está activo en el servidor'}
      >
        <Switch
          id="ai-global-switch"
          checked={settings.aiEnabled}
          disabled={!settings.canManage || pending}
          onCheckedChange={(enabled) => (enabled ? setConfirming(true) : apply(false))}
        />
        <Label htmlFor="ai-global-switch" className="text-sm font-normal">
          {statusText(settings)}
        </Label>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Encender la IA?</AlertDialogTitle>
            <AlertDialogDescription>
              El asistente responderá a los clientes en todas las conversaciones que no estén pausadas ni
              atendidas por un asesor. Puede apagarla en cualquier momento.
              {!settings.envEnabled && ' La IA está desactivada en el servidor, así que no responderá hasta que se active allí.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => apply(true)}>Encender</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
