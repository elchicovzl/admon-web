'use client'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface AiPauseToggleProps {
  conversationId: string
  paused: boolean
  disabled: boolean
  onChange: (paused: boolean) => void
}

/**
 * Per-conversation AI switch (WI-9). Pausing never moves the conversation: a paused AI chat gets
 * no AI replies and behaves like one attended by a person until the switch is turned back on.
 */
export function AiPauseToggle({ conversationId, paused, disabled, onChange }: AiPauseToggleProps) {
  const id = `ai-toggle-${conversationId}`
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={!paused} disabled={disabled} onCheckedChange={(active) => onChange(!active)} />
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {paused ? 'IA pausada' : 'IA activa'}
      </Label>
    </div>
  )
}
