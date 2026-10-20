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

interface ResendConfirmDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Asked before resending a message whose delivery could not be confirmed: WhatsApp cannot recall
 * a message, so a second send may reach the customer twice.
 */
export function ResendConfirmDialog({ open, onConfirm, onCancel }: ResendConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Enviar de nuevo este mensaje?</AlertDialogTitle>
          <AlertDialogDescription>
            No se pudo confirmar si este mensaje llegó al cliente. Revise el chat de WhatsApp antes de continuar:
            si ya fue entregado, el cliente lo recibirá dos veces.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Enviar de nuevo</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
