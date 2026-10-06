import { Metadata } from 'next'
import { auth } from '@/lib/auth/auth'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UserRole } from '@prisma/client'
import { ProfileSettingsForm } from '@/components/dashboard/profile-settings-form'
import { ConfiguracionEmpresaForm } from '@/components/dashboard/configuracion-empresa-form'
import { getConfiguracionEmpresa } from '@/lib/actions/configuracion-empresa.actions'

export const metadata: Metadata = {
  title: 'Configuración | Dashboard',
  description: 'Configuración de tu cuenta',
}

export default async function SettingsPage() {
  const session = await auth()

  if (!session?.user) {
    return null
  }

  const esSuperAdmin = session.user.role === UserRole.SUPER_ADMIN
  // A failed read must not look like "never configured": the form is only
  // rendered when the read succeeded, otherwise the error is shown instead.
  const lecturaEmpresa = esSuperAdmin ? await getConfiguracionEmpresa() : null
  const configuracionEmpresa = lecturaEmpresa?.success ? lecturaEmpresa.data : null
  const errorEmpresa =
    lecturaEmpresa && !lecturaEmpresa.success
      ? lecturaEmpresa.error ?? 'No se pudo leer la configuración de la empresa'
      : null

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

      {errorEmpresa && (
        <Alert variant="destructive" className="max-w-2xl">
          <AlertTitle>Datos de la empresa</AlertTitle>
          <AlertDescription>{errorEmpresa}</AlertDescription>
        </Alert>
      )}

      {esSuperAdmin && !errorEmpresa && (
        <ConfiguracionEmpresaForm
          initialValues={{
            razonSocial: configuracionEmpresa?.razonSocial ?? '',
            nit: configuracionEmpresa?.nit ?? '',
            direccion: configuracionEmpresa?.direccion ?? '',
            ciudad: configuracionEmpresa?.ciudad ?? '',
            telefono: configuracionEmpresa?.telefono ?? '',
            email: configuracionEmpresa?.email ?? '',
          }}
        />
      )}

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
