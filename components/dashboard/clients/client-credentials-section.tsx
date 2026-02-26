'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { SafeClientCredential } from '@/lib/types/client.types'
import { deleteCredential } from '@/lib/actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
} from '@/components/ui/alert-dialog'
import { CredentialCard } from './credential-card'
import { KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const CredentialFormDialog = dynamic(
  () => import('./credential-form-dialog')
    .then(mod => ({ default: mod.CredentialFormDialog })),
  { ssr: false }
)

interface ClientCredentialsSectionProps {
  clientId: string
  initialCredentials: SafeClientCredential[]
}

export function ClientCredentialsSection({
  clientId,
  initialCredentials,
}: ClientCredentialsSectionProps) {
  const [credentials, setCredentials] = useState<SafeClientCredential[]>(initialCredentials)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingCredential, setEditingCredential] = useState<SafeClientCredential | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingCredentialId, setDeletingCredentialId] = useState<string | null>(null)
  const [isDeletingCredential, setIsDeletingCredential] = useState(false)

  const handleCredentialCreated = (newCredential: SafeClientCredential) => {
    setCredentials((prev) => [newCredential, ...prev])
  }

  const handleCredentialUpdated = (
    credentialId: string,
    updates: Partial<SafeClientCredential>
  ) => {
    setCredentials((prev) =>
      prev.map((c) => (c.id === credentialId ? { ...c, ...updates } : c))
    )
  }

  const handleEditClick = (credential: SafeClientCredential) => {
    setEditingCredential(credential)
    setEditDialogOpen(true)
  }

  const handleDeleteClick = (credentialId: string) => {
    setDeletingCredentialId(credentialId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingCredentialId) return

    setIsDeletingCredential(true)

    try {
      const result = await deleteCredential(deletingCredentialId)

      if (result.success) {
        toast.success(result.message || 'Credencial eliminada exitosamente')
        setCredentials((prev) => prev.filter((c) => c.id !== deletingCredentialId))
        setDeleteDialogOpen(false)
        setDeletingCredentialId(null)
      } else {
        toast.error(result.error || 'Error al eliminar credencial')
      }
    } catch (error) {
      console.error('Delete credential error:', error)
      toast.error('Error inesperado al eliminar credencial')
    } finally {
      setIsDeletingCredential(false)
    }
  }

  const handleEditDialogClose = (open: boolean) => {
    setEditDialogOpen(open)
    if (!open) {
      setEditingCredential(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Credenciales de Administradoras
              </CardTitle>
              <CardDescription>
                Gestiona los accesos a portales de EPS, AFP, ARL, CCF y otros servicios
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <KeyRound className="mr-2 h-4 w-4" />
              Agregar Credencial
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {credentials.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No hay credenciales guardadas para este cliente
            </div>
          ) : (
            <div className="rounded-md border divide-y">
              {credentials.map((credential) => (
                <CredentialCard
                  key={credential.id}
                  credential={credential}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteClick}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <CredentialFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        clientId={clientId}
        onCredentialCreated={handleCredentialCreated}
      />

      {/* Edit Dialog */}
      <CredentialFormDialog
        open={editDialogOpen}
        onOpenChange={handleEditDialogClose}
        clientId={clientId}
        editCredential={editingCredential}
        onCredentialUpdated={handleCredentialUpdated}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La credencial será eliminada permanentemente.
              Asegúrate de tener respaldo de la información si la necesitas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCredential}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeletingCredential}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingCredential && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
