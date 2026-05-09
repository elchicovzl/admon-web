'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-1 rounded-full border border-primary/20 bg-background/95 backdrop-blur-sm shadow-lg pl-1 pr-1 py-1">
        <Button
          asChild
          size="sm"
          className="rounded-full h-9 px-4 gap-2"
        >
          <Link href={href}>
            <ArrowLeft className="h-4 w-4" />
            <span className="font-medium">Volver al sub-proceso</span>
          </Link>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => setDismissed(true)}
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
