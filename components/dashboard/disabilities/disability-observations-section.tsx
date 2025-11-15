'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { DisabilityObservation } from '@/lib/types/disability.types'
import { addDisabilityObservation, deleteDisabilityObservation } from '@/lib/actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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

interface DisabilityObservationsSectionProps {
  disabilityId: string
  observations: DisabilityObservation[]
  currentUserId?: string
  currentUserRole?: string
  onObservationAdded?: (observation: DisabilityObservation) => void
  onObservationDeleted?: (observationId: string) => void
}

export function DisabilityObservationsSection({
  disabilityId,
  observations,
  currentUserId,
  currentUserRole,
  onObservationAdded,
  onObservationDeleted,
}: DisabilityObservationsSectionProps) {
  const [newObservation, setNewObservation] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleAddObservation = async () => {
    if (!newObservation.trim()) {
      toast.error('La observación no puede estar vacía')
      return
    }

    setIsAdding(true)

    try {
      const result = await addDisabilityObservation(disabilityId, newObservation.trim())

      if (result.success && result.data) {
        toast.success(result.message || 'Observación agregada')
        setNewObservation('')
        onObservationAdded?.(result.data)
      } else {
        toast.error(result.error || 'Error al agregar observación')
      }
    } catch (error) {
      console.error('Add observation error:', error)
      toast.error('Error inesperado')
    } finally {
      setIsAdding(false)
    }
  }

  const handleDeleteObservation = async (observationId: string) => {
    setDeletingId(observationId)

    try {
      const result = await deleteDisabilityObservation(observationId)

      if (result.success) {
        toast.success(result.message || 'Observación eliminada')
        onObservationDeleted?.(observationId)
      } else {
        toast.error(result.error || 'Error al eliminar observación')
      }
    } catch (error) {
      console.error('Delete observation error:', error)
      toast.error('Error inesperado')
    } finally {
      setDeletingId(null)
    }
  }

  const canDeleteObservation = (observation: DisabilityObservation) => {
    if (!currentUserId) return false
    // SUPER_ADMIN can delete any observation, others can only delete their own
    return (
      currentUserRole === 'SUPER_ADMIN' ||
      observation.createdById === currentUserId
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Observaciones
        </CardTitle>
        <CardDescription>Notas y comentarios sobre esta incapacidad</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new observation */}
        <div className="space-y-2">
          <Textarea
            placeholder="Escribe una nueva observación..."
            value={newObservation}
            onChange={(e) => setNewObservation(e.target.value)}
            disabled={isAdding}
            className="min-h-[100px]"
          />
          <div className="flex justify-end">
            <Button onClick={handleAddObservation} disabled={isAdding || !newObservation.trim()}>
              {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Agregar Observación
            </Button>
          </div>
        </div>

        {/* Observations list */}
        <div className="space-y-3">
          {observations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay observaciones aún. Sé el primero en agregar una.
            </div>
          ) : (
            observations.map((observation) => (
              <Card key={observation.id} className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <p className="text-sm whitespace-pre-wrap">{observation.content}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="font-normal">
                          {observation.createdBy?.name || observation.createdBy?.email || 'Usuario'}
                        </Badge>
                        <span>•</span>
                        <span>
                          {format(new Date(observation.createdAt), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
                        </span>
                      </div>
                    </div>

                    {canDeleteObservation(observation) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            disabled={deletingId === observation.id}
                          >
                            {deletingId === observation.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar observación?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. La observación será eliminada permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteObservation(observation.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
