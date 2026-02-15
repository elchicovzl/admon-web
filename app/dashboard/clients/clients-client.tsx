/**
 * Clients Client Component
 * Client-side logic for clients list page
 */

'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { SafeClient } from '@/lib/types/client.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'
import { ClientsTable } from '@/components/dashboard/clients/clients-table'

const ClientFormDialog = dynamic(
  () => import('@/components/dashboard/clients/client-form-dialog')
    .then(mod => ({ default: mod.ClientFormDialog })),
  { ssr: false }
)

interface ClientsClientProps {
  initialClients: SafeClient[]
}

export function ClientsClient({ initialClients }: ClientsClientProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<SafeClient | null>(null)

  function handleClientCreated() {
    // Server Action already calls revalidatePath
    setCreateDialogOpen(false)
  }

  function handleClientUpdated() {
    // Server Action already calls revalidatePath
    setEditDialogOpen(false)
    setEditingClient(null)
  }

  const handleEditClient = (client: SafeClient) => {
    setEditingClient(client)
    setEditDialogOpen(true)
  }

  const handleEditDialogClose = (open: boolean) => {
    setEditDialogOpen(open)
    if (!open) {
      setEditingClient(null)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Clientes</h1>
          <p className="text-muted-foreground">
            Administra los clientes del sistema
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Crear Cliente
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
          <CardDescription>
            Lista completa de clientes del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientsTable
            clients={initialClients}
            onEditClient={handleEditClient}
          />
        </CardContent>
      </Card>

      <ClientFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onClientCreated={handleClientCreated}
      />

      <ClientFormDialog
        open={editDialogOpen}
        onOpenChange={handleEditDialogClose}
        onClientUpdated={handleClientUpdated}
        editClient={editingClient}
      />
    </>
  )
}
