import { Metadata } from 'next'
import { auth } from '@/lib/auth/auth'
import { getUsersCount } from '@/lib/actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, UserCheck, Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Dashboard | Admon Web',
  description: 'Panel de administración',
}

export default async function DashboardPage() {
  const session = await auth()
  const usersCountResult = await getUsersCount()

  const stats = {
    total: usersCountResult.data?.total || 0,
    superAdmins: usersCountResult.data?.superAdmins || 0,
    managers: usersCountResult.data?.managers || 0,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Bienvenido, {session?.user?.name || session?.user?.email}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Usuarios
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              Usuarios registrados en el sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Super Admins
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.superAdmins}</div>
            <p className="text-xs text-muted-foreground">
              Administradores del sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Managers
            </CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.managers}</div>
            <p className="text-xs text-muted-foreground">
              Gestores activos
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Información del Usuario</CardTitle>
            <CardDescription>
              Detalles de tu cuenta actual
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Nombre:</span>
              <span className="text-sm font-medium">
                {session?.user?.name || 'No especificado'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Email:</span>
              <span className="text-sm font-medium">{session?.user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Rol:</span>
              <span className="text-sm font-medium">
                {session?.user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Manager'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accesos Rápidos</CardTitle>
            <CardDescription>
              Funciones principales del dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {session?.user?.role === 'SUPER_ADMIN' && (
              <div className="rounded-lg border p-3">
                <h4 className="text-sm font-medium">Gestión de Usuarios</h4>
                <p className="text-xs text-muted-foreground">
                  Crear, editar y eliminar usuarios del sistema
                </p>
              </div>
            )}
            <div className="rounded-lg border p-3">
              <h4 className="text-sm font-medium">Configuración</h4>
              <p className="text-xs text-muted-foreground">
                Personaliza tu cuenta y preferencias
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
