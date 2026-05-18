/**
 * SubProcess Observations Section Component
 * Manages observations/notes for a sub-process
 */

'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { MessageSquare, Trash2, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { addObservation, deleteObservation } from '@/lib/actions/affiliation.actions'
import type { AffiliationObservationWithRelations } from '@/lib/types/affiliation.types'

interface SubProcessObservationsSectionProps {
  subProcessId: string
  observations: AffiliationObservationWithRelations[]
  currentUserId?: string
  currentUserRole?: string
  onObservationAdded?: (observation: AffiliationObservationWithRelations) => void
  onObservationDeleted?: (observationId: string) => void
}

export function SubProcessObservationsSection({
  subProcessId,
  observations,
  currentUserId,
  currentUserRole,
  onObservationAdded,
  onObservationDeleted,
}: SubProcessObservationsSectionProps) {
  const [newObservation, setNewObservation] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [observationToDelete, setObservationToDelete] = useState<string | null>(null)

  async function handleAddObservation() {
    if (!newObservation.trim()) {
      toast.error('La observación no puede estar vacía')
      return
    }

    if (newObservation.trim().length < 3) {
      toast.error('La observación debe tener al menos 3 caracteres')
      return
    }

    setLoading(true)
    try {
      const result = await addObservation({
        subProcessId,
        content: newObservation.trim(),
      })

      if (result.success && result.data) {
        toast.success('Observación agregada exitosamente')
        setNewObservation('')
        onObservationAdded?.(result.data)
      } else {
        toast.error(result.error || 'Error al agregar observación')
      }
    } catch (error) {
      console.error('Error adding observation:', error)
      toast.error('Error al agregar observación')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteObservation() {
    if (!observationToDelete) return

    setLoading(true)
    try {
      const result = await deleteObservation(observationToDelete)

      if (result.success) {
        toast.success('Observación eliminada exitosamente')
        onObservationDeleted?.(observationToDelete)
        setDeleteDialogOpen(false)
        setObservationToDelete(null)
      } else {
        toast.error(result.error || 'Error al eliminar observación')
      }
    } catch (error) {
      console.error('Error deleting observation:', error)
      toast.error('Error al eliminar observación')
    } finally {
      setLoading(false)
    }
  }

  function canDeleteObservation(observation: AffiliationObservationWithRelations) {
    if (!currentUserId) return false
    return currentUserRole === 'SUPER_ADMIN' || observation.createdBy?.id === currentUserId
  }

  function openDeleteDialog(observationId: string) {
    setObservationToDelete(observationId)
    setDeleteDialogOpen(true)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Observaciones
              </CardTitle>
              <CardDescription>
                Notas y comentarios sobre este sub-proceso
              </CardDescription>
            </div>
            <Badge variant="secondary">{observations.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add New Observation Form */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Agregar Observación</label>
            <Textarea
              placeholder="Escribe una observación o nota sobre este sub-proceso..."
              value={newObservation}
              onChange={(e) => setNewObservation(e.target.value)}
              rows={3}
              disabled={loading}
            />
            <Button
              onClick={handleAddObservation}
              disabled={loading || !newObservation.trim()}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Agregar Observación
            </Button>
          </div>

          {/* Observations List */}
          {observations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No hay observaciones todavía</p>
              <p className="text-xs mt-1">Agrega la primera observación arriba</p>
            </div>
          ) : (
            <div className="space-y-3">
              {observations.map((observation) => (
                <div
                  key={observation.id}
                  className="rounded-lg p-4 space-y-2 border border-amber-300 bg-amber-50 hover:bg-amber-100/60 dark:border-amber-900/50 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className="text-xs border-amber-300 bg-white/70 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                        >
                          {observation.createdBy?.name || observation.createdBy?.email}
                        </Badge>
                        <span className="text-xs text-amber-800/80 dark:text-amber-200/80">
                          {format(new Date(observation.createdAt), "d 'de' MMM 'de' yyyy 'a las' HH:mm", {
                            locale: es,
                          })}
                        </span>
                      </div>
                      <p className="mt-2 text-sm whitespace-pre-wrap text-amber-900 dark:text-amber-100">{observation.content}</p>
                    </div>
                    {canDeleteObservation(observation) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(observation.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-amber-100 dark:hover:bg-amber-950/50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar observación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La observación será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteObservation}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
