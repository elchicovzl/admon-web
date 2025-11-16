import { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@/lib/auth/auth'
import { getUsersCount } from '@/lib/actions'
import { getMyAssignmentsStats } from '@/lib/actions/affiliation.actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, UserCheck, Shield, FileText, Clock, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Dashboard | Admon Web',
  description: 'Panel de administración',
}

export default async function DashboardPage() {
  const session = await auth()
  const [usersCountResult, myAssignmentsStatsResult] = await Promise.all([
    getUsersCount(),
    getMyAssignmentsStats(),
  ])

  const stats = {
    total: usersCountResult.data?.total || 0,
    superAdmins: usersCountResult.data?.superAdmins || 0,
    managers: usersCountResult.data?.managers || 0,
  }

  const myAssignmentsStats = myAssignmentsStatsResult.success ? myAssignmentsStatsResult.data : null

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

      {/* My Assignments Widget */}
      {myAssignmentsStats && myAssignmentsStats.total > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Mis Asignaciones</CardTitle>
                <CardDescription>
                  Sub-procesos de afiliación asignados a ti
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/affiliations/my-assignments">
                  Ver Todos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{myAssignmentsStats.inProgress}</p>
                  <p className="text-xs text-muted-foreground">En Proceso</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{myAssignmentsStats.pendingSupport}</p>
                  <p className="text-xs text-muted-foreground">Pendientes</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{myAssignmentsStats.completed}</p>
                  <p className="text-xs text-muted-foreground">Completados</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                  <FileText className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{myAssignmentsStats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
            <Link href="/dashboard/affiliations" className="block">
              <div className="rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                <h4 className="text-sm font-medium">Afiliaciones</h4>
                <p className="text-xs text-muted-foreground">
                  Gestionar procesos de afiliación a seguridad social
                </p>
              </div>
            </Link>
            {session?.user?.role === 'SUPER_ADMIN' && (
              <Link href="/dashboard/users" className="block">
                <div className="rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                  <h4 className="text-sm font-medium">Gestión de Usuarios</h4>
                  <p className="text-xs text-muted-foreground">
                    Crear, editar y eliminar usuarios del sistema
                  </p>
                </div>
              </Link>
            )}
            <Link href="/dashboard/clients" className="block">
              <div className="rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                <h4 className="text-sm font-medium">Clientes</h4>
                <p className="text-xs text-muted-foreground">
                  Ver y gestionar clientes registrados
                </p>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
