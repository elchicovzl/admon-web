'use client'

import { useEffect, useState } from 'react'
import { UserRole } from '@prisma/client'
import type { SafeUser } from '@/lib/types/auth.types'
import { getUsers } from '@/lib/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UsersTable } from '@/components/dashboard/users-table'
import { UsersTableSkeleton } from '@/components/dashboard/users-table-skeleton'
import { CreateUserForm } from '@/components/dashboard/create-user-form'
import { UserPlus } from 'lucide-react'

export default function UsersPage() {
  const [users, setUsers] = useState<SafeUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  useEffect(() => {
    async function loadUsers() {
      try {
        const result = await getUsers()
        if (result.success && result.data) {
          setUsers(result.data)
        }
      } catch (error) {
        console.error('Error loading users:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadUsers()
  }, [])

  const handleUserCreated = (newUser: SafeUser) => {
    setUsers((prevUsers) => [...prevUsers, newUser])
  }

  const handleUserUpdated = (userId: string, updates: Partial<SafeUser>) => {
    setUsers((prevUsers) =>
      prevUsers.map((u) => (u.id === userId ? { ...u, ...updates } : u))
    )
  }

  const managers = users.filter((u) => u.role === UserRole.MANAGER)
  const superAdmins = users.filter((u) => u.role === UserRole.SUPER_ADMIN)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">
            Administra los usuarios del sistema
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Crear Manager
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total de Usuarios</CardDescription>
            <CardTitle className="text-3xl">{users.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Usuarios registrados en el sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Super Admins</CardDescription>
            <CardTitle className="text-3xl">{superAdmins.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Administradores del sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Managers</CardDescription>
            <CardTitle className="text-3xl">{managers.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Gestores activos
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios</CardTitle>
          <CardDescription>
            Lista completa de usuarios del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <UsersTableSkeleton />
          ) : (
            <UsersTable users={users} onUserUpdated={handleUserUpdated} />
          )}
        </CardContent>
      </Card>

      <CreateUserForm
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onUserCreated={handleUserCreated}
      />
    </div>
  )
}
