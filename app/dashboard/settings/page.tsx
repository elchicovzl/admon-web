import { Metadata } from 'next'
import { auth } from '@/lib/auth/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export const metadata: Metadata = {
  title: 'Configuración | Dashboard',
  description: 'Configuración de tu cuenta',
}

export default async function SettingsPage() {
  const session = await auth()

  if (!session?.user) {
    return null
  }

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

  const getRoleBadge = (role: string) => {
    if (role === 'SUPER_ADMIN') {
      return <Badge variant="default">Super Admin</Badge>
    }
    return <Badge variant="secondary">Manager</Badge>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Administra tu cuenta y preferencias
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Información del Perfil</CardTitle>
          <CardDescription>
            Datos básicos de tu cuenta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={session.user.image || undefined} alt={session.user.name || session.user.email} />
              <AvatarFallback className="text-lg">
                {getUserInitials(session.user.name, session.user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold">{session.user.name || 'Sin nombre'}</h3>
              <p className="text-sm text-muted-foreground">{session.user.email}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Rol</span>
              {getRoleBadge(session.user.role)}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium">{session.user.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Nombre</span>
              <span className="text-sm font-medium">{session.user.name || 'No especificado'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Preferencias</CardTitle>
          <CardDescription>
            Personaliza tu experiencia en el dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-medium">Tema</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Selecciona el tema de la interfaz (claro, oscuro o automático)
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Funcionalidad próximamente disponible
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-medium">Notificaciones</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Configura cómo y cuándo deseas recibir notificaciones
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Funcionalidad próximamente disponible
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
