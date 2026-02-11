/**
 * Send Affiliation Button Component
 * Button with confirmation dialog to send affiliation to client
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { sendAffiliation } from '@/lib/actions/affiliation.actions'
import { Send, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface SendAffiliationButtonProps {
  affiliationId: string
  clientName: string
  allCompleted: boolean
  currentStatus: string
}

export function SendAffiliationButton({
  affiliationId,
  clientName,
  allCompleted,
  currentStatus,
}: SendAffiliationButtonProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Only show button if affiliation is ACTIVE and all sub-processes are COMPLETED
  if (currentStatus !== 'ACTIVE' || !allCompleted) {
    return null
  }

  const handleSend = async () => {
    setIsLoading(true)
    try {
      const result = await sendAffiliation(affiliationId)

      if (result.success) {
        toast.success(result.message || 'Afiliación enviada exitosamente')
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error || 'Error al enviar la afiliación')
      }
    } catch (error) {
      console.error('Error sending affiliation:', error)
      toast.error('Error inesperado al enviar la afiliación')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button className="gap-2">
          <Send className="h-4 w-4" />
          Enviar Afiliación al Cliente
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Enviar afiliación a {clientName}?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Esta acción enviará la afiliación completada al cliente y la archivará
              inmediatamente.
            </p>
            <p className="font-semibold text-yellow-600">
              ⚠️ Esta acción es permanente y no se puede deshacer.
            </p>
            <p>La afiliación desaparecerá del kanban y estará disponible en el archivo.</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleSend()
            }}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Sí, Enviar Afiliación
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
