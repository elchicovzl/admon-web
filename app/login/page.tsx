import { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Iniciar Sesión | Admin Dashboard',
  description: 'Inicia sesión en tu cuenta',
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Bienvenido
          </CardTitle>
          <CardDescription className="text-center">
            Ingresa tus credenciales para acceder al dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Credenciales de prueba:</p>
            <p className="mt-2 font-mono text-xs">
              Admin: admin@admon.com / admin123
            </p>
            <p className="font-mono text-xs">
              Manager: manager@admon.com / manager123
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
