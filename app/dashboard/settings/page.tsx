import { Metadata } from 'next'
import { auth } from '@/lib/auth/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileSettingsForm } from '@/components/dashboard/profile-settings-form'

export const metadata: Metadata = {
  title: 'Configuración | Dashboard',
  description: 'Configuración de tu cuenta',
}

export default async function SettingsPage() {
  const session = await auth()

  if (!session?.user) {
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Administra tu cuenta y preferencias
        </p>
      </div>

      <ProfileSettingsForm
        user={{
          name: session.user.name ?? null,
          email: session.user.email!,
          image: session.user.image ?? null,
          role: session.user.role,
        }}
      />

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
