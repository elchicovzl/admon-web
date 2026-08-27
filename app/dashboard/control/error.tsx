'use client'

import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ControlError({ error, reset }: ErrorProps) {
  // No se muestra `error.message` crudo: en este módulo un mensaje de error
  // puede arrastrar nombres de personas y montos de préstamos.
  const esAutorizacion = error.message.includes('Unauthorized')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Control</h1>
        <p className="text-muted-foreground">Libro de caja interno</p>
      </div>

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>
          {esAutorizacion ? 'No tenés acceso a este módulo' : 'Algo se rompió'}
        </AlertTitle>
        <AlertDescription className="space-y-4">
          <p>
            {esAutorizacion
              ? 'Pedile a un Super Admin que te habilite el acceso a Control desde Usuarios.'
              : 'No se pudo cargar la información. Volvé a intentar; si sigue pasando, avisá con la hora exacta.'}
          </p>
          {error.digest && (
            <p className="text-xs opacity-70">Referencia: {error.digest}</p>
          )}
          {!esAutorizacion && (
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          )}
        </AlertDescription>
      </Alert>
    </div>
  )
}
