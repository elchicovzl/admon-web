/**
 * Users Client Component
 * Client-side logic for users list page
 */

'use client'

import { useState } from 'react'
import type { SafeUser } from '@/lib/types/auth.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'
import { UsersTable } from '@/components/dashboard/users-table'
import { CreateUserForm } from '@/components/dashboard/create-user-form'

interface UsersClientProps {
  initialUsers: SafeUser[]
}

export function UsersClient({ initialUsers }: UsersClientProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  function handleUserCreated() {
    // Server Action already calls revalidatePath
    setCreateDialogOpen(false)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
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

      <Card>
        <CardHeader>
          <CardTitle>Usuarios</CardTitle>
          <CardDescription>
            Lista completa de usuarios del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsersTable users={initialUsers} />
        </CardContent>
      </Card>

      <CreateUserForm
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onUserCreated={handleUserCreated}
      />
    </>
  )
}
