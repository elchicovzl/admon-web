/**
 * Send Affiliation Button Component
 * Navigates to the email compose page
 */

'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'

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
  // Only show button if affiliation is ACTIVE and all sub-processes are COMPLETED
  if (currentStatus !== 'ACTIVE' || !allCompleted) {
    return null
  }

  return (
    <Button className="gap-2" asChild>
      <Link href={`/dashboard/affiliations/${affiliationId}/send`}>
        <Send className="h-4 w-4" />
        Enviar Afiliación al Cliente
      </Link>
    </Button>
  )
}
