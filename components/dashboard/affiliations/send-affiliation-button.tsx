/**
 * Send Affiliation Button Component
 * Navigates to the email compose page with loading state
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Send, Loader2 } from 'lucide-react'

interface SendAffiliationButtonProps {
  affiliationId: string
  clientName: string
  clientEmail: string
  allCompleted: boolean
  currentStatus: string
}

export function SendAffiliationButton({
  affiliationId,
  allCompleted,
  currentStatus,
}: SendAffiliationButtonProps) {
  const [isNavigating, setIsNavigating] = useState(false)
  const router = useRouter()

  // Only show button if affiliation is ACTIVE and all sub-processes are COMPLETED
  if (currentStatus !== 'ACTIVE' || !allCompleted) {
    return null
  }

  const handleClick = () => {
    setIsNavigating(true)
    router.push(`/dashboard/affiliations/${affiliationId}/send`)
  }

  return (
    <Button className="gap-2" onClick={handleClick} disabled={isNavigating}>
      {isNavigating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando...
        </>
      ) : (
        <>
          <Send className="h-4 w-4" />
          Enviar Afiliación al Cliente
        </>
      )}
    </Button>
  )
}
