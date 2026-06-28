'use client'

/**
 * Error boundary for the /dashboard/finances route.
 *
 * Catches errors thrown by the page (Server Component) including:
 *   - AlegraError (network errors)
 *   - AuthError (401 — invalid credentials)
 *   - RateLimitError (429 — though the client auto-waits, can still bubble)
 *   - ValidationError (Zod fail — API drift)
 *
 * Shows a friendly message + a "Reintentar" button that reloads the route.
 * Server-side details are logged to the server console (not shown to the user).
 */

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

function classifyError(message: string): { title: string; description: string } {
  const m = message.toLowerCase()
  if (m.includes('credencial') || m.includes('auth') || m.includes('401')) {
    return {
      title: 'Credenciales de Alegra inválidas',
      description: 'El token guardado en las variables de entorno no funciona. Contactá al administrador.',
    }
  }
  if (m.includes('rate limit') || m.includes('429')) {
    return {
      title: 'Alegra saturado',
      description: 'La API de Alegra recibió muchas requests. La próxima vez que recargues debería funcionar.',
    }
  }
  if (m.includes('shape') || m.includes('validation') || m.includes('zod') || m.includes('inesperado')) {
    return {
      title: 'Alegra cambió su API',
      description: 'La respuesta de Alegra no coincide con lo esperado. Reportá al equipo de desarrollo.',
    }
  }
  return {
    title: 'Error de conexión con Alegra',
    description: 'No se pudieron obtener los datos financieros. Verificá la conectividad y volvé a intentar.',
  }
}

export default function FinancesError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Server-side log already happened. Don't expose digest/stack to user.
    console.error('[Finances] error boundary:', error)
  }, [error])

  const { title, description } = classifyError(error.message)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Finanzas</h1>
        <p className="text-muted-foreground">Resumen de facturación</p>
      </div>

      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">{title}</CardTitle>
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={reset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Volver al dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
