'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { addClientNote, deleteClientNote } from '@/lib/actions'
import { addClientNoteSchema, type AddClientNoteInput } from '@/lib/validations/client.schema'
import type { ClientNote } from '@/lib/types/client.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { MessageSquarePlus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface ClientNotesSectionProps {
  clientId: string
  initialNotes: ClientNote[]
}

export function ClientNotesSection({ clientId, initialNotes }: ClientNotesSectionProps) {
  const [notes, setNotes] = useState<ClientNote[]>(initialNotes)
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [isDeletingNote, setIsDeletingNote] = useState(false)
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null)

  const form = useForm<AddClientNoteInput>({
    resolver: zodResolver(addClientNoteSchema),
    defaultValues: {
      clientId,
      content: '',
    },
  })

  const getUserInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return email[0].toUpperCase()
  }

  async function onSubmit(data: AddClientNoteInput) {
    setIsAddingNote(true)

    try {
      const result = await addClientNote(data.clientId, data.content)

      if (result.success && result.data) {
        toast.success(result.message || 'Nota agregada exitosamente')
        setNotes((prev) => [result.data!, ...prev])
        form.reset({ clientId, content: '' })
      } else {
        toast.error(result.error || 'Error al agregar nota')
      }
    } catch (error) {
      console.error('Add note error:', error)
      toast.error('Error inesperado al agregar nota')
    } finally {
      setIsAddingNote(false)
    }
  }

  async function handleDeleteNote(noteId: string) {
    setIsDeletingNote(true)

    try {
      const result = await deleteClientNote(noteId)

      if (result.success) {
        toast.success(result.message || 'Nota eliminada exitosamente')
        setNotes((prev) => prev.filter((n) => n.id !== noteId))
        setDeleteNoteId(null)
      } else {
        toast.error(result.error || 'Error al eliminar nota')
      }
    } catch (error) {
      console.error('Delete note error:', error)
      toast.error('Error inesperado al eliminar nota')
    } finally {
      setIsDeletingNote(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Notas del Cliente</CardTitle>
          <CardDescription>
            Agrega notas y comentarios sobre este cliente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Note Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Escribe una nota sobre este cliente..."
                        className="min-h-[100px] resize-none"
                        disabled={isAddingNote}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={isAddingNote}>
                  {isAddingNote ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquarePlus className="mr-2 h-4 w-4" />
                  )}
                  Agregar Nota
                </Button>
              </div>
            </form>
          </Form>

          {/* Notes Timeline */}
          {notes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay notas para este cliente
            </div>
          ) : (
            <div className="space-y-4 mt-6">
              <h3 className="font-semibold text-sm">Historial de Notas</h3>
              <div className="space-y-4">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="flex gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {note.createdBy
                          ? getUserInitials(note.createdBy.name, note.createdBy.email)
                          : '??'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">
                            {note.createdBy?.name || note.createdBy?.email || 'Usuario'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(note.createdAt), "d 'de' MMMM, yyyy 'a las' HH:mm", {
                              locale: es,
                            })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteNoteId(note.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteNoteId !== null} onOpenChange={() => setDeleteNoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La nota será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingNote}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteNoteId && handleDeleteNote(deleteNoteId)}
              disabled={isDeletingNote}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingNote && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
