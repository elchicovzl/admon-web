'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ClipboardList, Contact, Loader2 } from 'lucide-react'

export function DashboardQuickLinks() {
  const router = useRouter()
  const [isNavigating, startTransition] = useTransition()

  function navigate(href: string) {
    startTransition(() => router.push(href))
  }

  return (
    <Card className="relative">
      {isNavigating && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
          <div className="flex items-center gap-3 bg-card border shadow-lg rounded-lg px-6 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Cargando...</span>
          </div>
        </div>
      )}
      <CardHeader>
        <CardTitle>Accesos Rápidos</CardTitle>
        <CardDescription>
          Funciones principales del dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          <div
            onClick={() => navigate('/dashboard/affiliations')}
            className="flex items-center gap-3 rounded-lg bg-blue-50 p-4 hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-blue-900">Afiliaciones</h4>
              <p className="text-xs text-blue-600">Gestionar procesos</p>
            </div>
          </div>

          <div
            onClick={() => navigate('/dashboard/clients')}
            className="flex items-center gap-3 rounded-lg bg-amber-50 p-4 hover:bg-amber-100 transition-colors cursor-pointer"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
              <Contact className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-900">Clientes</h4>
              <p className="text-xs text-amber-600">Ver y gestionar</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
