'use client'

/**
 * Reusable error UI shell for the finances module.
 *
 * Calls from any error.tsx:
 *   return <FinancesErrorShell error={error} reset={reset}
 *                       surface="Resumen"
 *                       homeHref="/dashboard/finances" />
 *
 * The classification logic + message catalog live in `@/lib/alegra/error-ui`
 * (pure .ts so Vitest can import them without a React JSX transform).
 *
 * @param surface Human label for what page broke — shown in the heading
 *               ("Resumen", "Listado de facturas", "Detalle de factura")
 * @param homeHref Where the "← Volver" button points (typically /dashboard/finances)
 */

import Link from 'next/link'
import { useEffect } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { classifyAlegraError } from '@/lib/alegra/error-classifier'

export function FinancesErrorShell({
  error,
  reset,
  surface,
  homeHref,
}: {
  error: Error & { digest?: string }
  reset: () => void
  surface: string
  homeHref: string
}) {
  const classified = classifyAlegraError(error)

  // Server-side log already happens; don't expose digest/stack to user.
  useEffect(() => {
    console.error('[Finances] error boundary:', error)
  }, [error])

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-destructive">{classified.title}</CardTitle>
        </div>
        <CardDescription>{classified.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button onClick={reset}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reintentar
        </Button>
        <Button asChild variant="outline">
          <Link href={homeHref}>← Volver al {surface.toLowerCase()}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/dashboard">Inicio</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
