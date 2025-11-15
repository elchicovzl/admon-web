'use client'

import { useEffect, useState } from 'react'
import type { SafeClient } from '@/lib/types/client.types'
import { getClients, getClientsCount } from '@/lib/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ClientsTable } from '@/components/dashboard/clients/clients-table'
import { ClientsTableSkeleton } from '@/components/dashboard/clients/clients-table-skeleton'
import { ClientFormDialog } from '@/components/dashboard/clients/client-form-dialog'
import { UserPlus, Users, UserCheck, UserX, Briefcase } from 'lucide-react'

export default function ClientsPage() {
  const [clients, setClients] = useState<SafeClient[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<SafeClient | null>(null)
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
  })

  useEffect(() => {
    async function loadData() {
      try {
        const [clientsResult, statsResult] = await Promise.all([
          getClients(),
          getClientsCount(),
        ])

        if (clientsResult.success && clientsResult.data) {
          setClients(clientsResult.data)
        }

        if (statsResult.success && statsResult.data) {
          setStats({
            total: statsResult.data.total,
            active: statsResult.data.active,
            inactive: statsResult.data.inactive,
          })
        }
      } catch (error) {
        console.error('Error loading clients:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const handleClientCreated = (newClient: SafeClient) => {
    setClients((prevClients) => [newClient, ...prevClients])
    setStats((prev) => ({
      total: prev.total + 1,
      active: prev.active + 1,
      inactive: prev.inactive,
    }))
  }

  const handleClientUpdated = (clientId: string, updates: Partial<SafeClient>) => {
    setClients((prevClients) =>
      prevClients.map((c) => (c.id === clientId ? { ...c, ...updates } : c))
    )

    // Update stats if isActive changed
    if ('isActive' in updates) {
      setStats((prev) => ({
        total: prev.total,
        active: updates.isActive ? prev.active + 1 : prev.active - 1,
        inactive: updates.isActive ? prev.inactive - 1 : prev.inactive + 1,
      }))
    }
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Clientes
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              Clientes registrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Clientes Activos
            </CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              Con estado activo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Clientes Inactivos
            </CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inactive}</div>
            <p className="text-xs text-muted-foreground">
              Con estado inactivo
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
          <CardDescription>
            Lista completa de clientes del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ClientsTableSkeleton />
          ) : (
            <ClientsTable
              clients={clients}
              onClientUpdated={handleClientUpdated}
              onEditClient={handleEditClient}
            />
          )}
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
    </div>
  )
}
