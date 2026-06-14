'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RotateCcw } from 'lucide-react'
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
import { reactivateClient } from '@/lib/actions/client.actions'

interface ReactivateClientDialogProps {
  clientId: string
  clientName: string
}

export function ReactivateClientDialog({
  clientId,
  clientName,
}: ReactivateClientDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleReactivate = () => {
    startTransition(async () => {
      const result = await reactivateClient(clientId)

      if (result.success) {
        toast.success(result.message || 'Cliente reactivado exitosamente')
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error || 'Error al reactivar el cliente')
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="default" size="sm">
          <RotateCcw className="mr-2 h-4 w-4" />
          Reactivar cliente
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reactivar cliente</AlertDialogTitle>
          <AlertDialogDescription>
            Vas a reactivar a <span className="font-semibold">{clientName}</span>.
            El cliente volverá a estado <span className="font-semibold">Activo</span> y
            reaparecerá en el listado de clientes. Su historial no se modifica.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleReactivate()
            }}
            disabled={isPending}
          >
            {isPending ? 'Reactivando...' : 'Sí, reactivar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
