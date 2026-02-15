/**
 * Users Management Page
 * Server Component with progressive rendering
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import { getUsers } from '@/lib/actions/user.actions'
import { UsersClient } from './users-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Shield, UserCheck } from 'lucide-react'
import { UsersStatsSkeleton } from '@/components/dashboard/users/users-stats-skeleton'
import { UsersTableSkeleton } from '@/components/dashboard/users-table-skeleton'
import { UserRole } from '@prisma/client'

export const metadata: Metadata = {
  title: 'Usuarios | Dashboard',
  description: 'Gestión de usuarios del sistema',
}

// Async component for stats
async function UsersStats() {
  const usersResult = await getUsers()
  const users = usersResult.success ? usersResult.data || [] : []

  const total = users.length
  const managers = users.filter((u) => u.role === UserRole.MANAGER).length
  const superAdmins = users.filter((u) => u.role === UserRole.SUPER_ADMIN).length

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Usuarios</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{total}</div>
          <p className="text-xs text-muted-foreground">
            Usuarios registrados en el sistema
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Super Admins</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{superAdmins}</div>
          <p className="text-xs text-muted-foreground">
            Administradores del sistema
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Managers</CardTitle>
          <UserCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{managers}</div>
          <p className="text-xs text-muted-foreground">
            Gestores activos
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// Async component for table
async function UsersTable() {
  const usersResult = await getUsers()
  const users = usersResult.success ? usersResult.data || [] : []

  return <UsersClient initialUsers={users} />
}

export default async function UsersPage() {
  return (
    <div className="space-y-6">
      {/* Stats - progressive rendering */}
      <Suspense fallback={<UsersStatsSkeleton />}>
        <UsersStats />
      </Suspense>

      {/* Table - progressive rendering */}
      <Suspense fallback={<UsersTableSkeleton />}>
        <UsersTable />
      </Suspense>
    </div>
  )
}
