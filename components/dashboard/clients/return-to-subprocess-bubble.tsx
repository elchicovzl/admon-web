'use client'

import { useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowLeft, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// Particle configuration: { size, drift x, delay s }
const PARTICLES: Array<{ size: number; tx: number; delay: number; opacity: number }> = [
  { size: 6, tx: 0, delay: 0, opacity: 0.9 },
  { size: 4, tx: -8, delay: 0.25, opacity: 0.75 },
  { size: 5, tx: 7, delay: 0.5, opacity: 0.8 },
  { size: 3, tx: -4, delay: 0.75, opacity: 0.7 },
  { size: 4, tx: 5, delay: 1, opacity: 0.7 },
  { size: 3, tx: -10, delay: 1.15, opacity: 0.6 },
]

interface ReturnToSubprocessBubbleProps {
  affiliationId: string
  subProcessId: string
}

export function ReturnToSubprocessBubble({
  affiliationId,
  subProcessId,
}: ReturnToSubprocessBubbleProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const href = `/dashboard/affiliations/${affiliationId}/subprocess/${subProcessId}`

  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 animate-in fade-in zoom-in-50 duration-500">
      <div className="relative animate-float">
        {/* Thruster particles — emitted from below the FAB */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 mt-1 h-12 w-12"
        >
          {PARTICLES.map((p, i) => (
            <span
              key={i}
              className="animate-thrust-particle absolute left-1/2 top-0 -translate-x-1/2 rounded-full bg-primary"
              style={{
                width: `${p.size}px`,
                height: `${p.size}px`,
                animationDelay: `${p.delay}s`,
                opacity: p.opacity,
                ['--tx' as string]: `${p.tx}px`,
              } as CSSProperties}
            />
          ))}
        </div>

        {/* Main circular FAB */}
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                size="icon"
                className="relative h-14 w-14 rounded-full shadow-xl hover:scale-110 active:scale-95 transition-transform"
              >
                <Link href={href} aria-label="Volver al sub-proceso">
                  <ArrowLeft className="h-6 w-6" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="font-medium">
              Volver al sub-proceso
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Dismiss X badge */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Cerrar"
          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-background border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
