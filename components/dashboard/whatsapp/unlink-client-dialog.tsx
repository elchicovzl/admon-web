'use client'

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

export type ContactDecision = 'unlink' | 'confirmUnknown'

const COPY: Record<ContactDecision, { title: string; description: string; confirm: string }> = {
  unlink: {
    title: '¿Desvincular este número del cliente?',
    description:
      'El número dejará de asociarse a este cliente y no se volverá a vincular solo. La conversación queda como lead.',
    confirm: 'Desvincular',
  },
  confirmUnknown: {
    title: '¿El número no es de ningún cliente?',
    description:
      'Varios clientes tienen este teléfono. Si ninguno es quien escribe, el número se registra como un lead nuevo y deja de marcarse como ambiguo.',
    confirm: 'Confirmar como lead',
  },
}

interface UnlinkClientDialogProps {
  decision: ContactDecision | null
  onConfirm: (decision: ContactDecision) => void
  onCancel: () => void
}

/** Confirmation for the two contact decisions that turn a conversation into a lead. */
export function UnlinkClientDialog({ decision, onConfirm, onCancel }: UnlinkClientDialogProps) {
  const copy = decision ? COPY[decision] : null
  return (
    <AlertDialog open={decision !== null} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => decision && onConfirm(decision)}>{copy?.confirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
