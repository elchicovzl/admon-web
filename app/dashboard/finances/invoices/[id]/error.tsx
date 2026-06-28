'use client'

/**
 * Error boundary for the invoice detail route.
 * Contextualized to a single invoice (different from the list / summary errors).
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
      description: 'La API recibió muchas requests. Vuelve a intentar en un minuto.',
    }
  }
  if (m.includes('not found') || m.includes('404') || m.includes('no existe')) {
    return {
      title: 'Factura no encontrada',
      description: 'Alegra no devolvió datos para esta factura. Verificá el ID o que la factura aún exista.',
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
    description: 'No se pudieron obtener los datos de la factura. Verificá la conectividad y volvé a intentar.',
  }
}

export default function InvoiceDetailError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[Finances/InvoiceDetail] error boundary:', error)
  }, [error])

  const { title, description } = classifyError(error.message)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Detalle de factura</h1>
        <p className="text-muted-foreground">Información de la factura emitida en Alegra</p>
      </div>

      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">{title}</CardTitle>
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={reset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/finances/invoices">← Volver al listado</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/dashboard">Inicio</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
