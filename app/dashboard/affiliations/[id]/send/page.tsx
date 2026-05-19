/**
 * Send Affiliation Email Page
 * Full page for composing and sending affiliation completion emails
 */

import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth/auth'
import {
  getAffiliationEmailData,
  getAffiliationResendData,
} from '@/lib/actions/affiliation.actions'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { SendAffiliationEmailClient } from './send-affiliation-email-client'

export const metadata: Metadata = {
  title: 'Enviar Afiliación | Dashboard',
  description: 'Componer y enviar correo de afiliación completada',
}

export default async function SendAffiliationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ resend?: string }>
}) {
  const session = await auth()
  if (!session?.user) {
    redirect('/login')
  }

  const { id } = await params
  const sp = await searchParams
  const isResend = sp?.resend === '1'

  const result = isResend
    ? await getAffiliationResendData(id)
    : await getAffiliationEmailData(id)

  if (!result.success || !result.data) {
    notFound()
  }

  const backHref = isResend
    ? '/dashboard/affiliations/archived'
    : `/dashboard/affiliations/${id}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isResend ? 'Reenviar Correo de Afiliación' : 'Enviar Afiliación al Cliente'}
          </h1>
          <p className="text-muted-foreground">
            {isResend
              ? 'Editá destinatario, adjuntos y contenido. La afiliación seguirá archivada.'
              : 'Componga y envíe el correo de notificación con los documentos adjuntos'}
          </p>
        </div>
      </div>

      {/* Client component with form */}
      <SendAffiliationEmailClient
        affiliationId={id}
        emailData={result.data}
        isResend={isResend}
      />
    </div>
  )
}
