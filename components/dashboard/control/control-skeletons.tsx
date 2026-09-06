import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

/** Fila de tarjetas de KPI. */
export function ControlStatsSkeleton({ tarjetas = 4 }: { tarjetas?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: tarjetas }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-4 rounded" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-40" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/** Tabla genérica del módulo. */
export function ControlTableSkeleton({
  filas = 8,
  columnas = 6,
}: {
  filas?: number
  columnas?: number
}) {
  return (
    <div className="rounded-md border">
      <div className="flex gap-4 border-b p-4">
        {Array.from({ length: columnas }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: filas }).map((_, fila) => (
        <div key={fila} className="flex gap-4 border-b p-4 last:border-0">
          {Array.from({ length: columnas }).map((_, col) => (
            <Skeleton key={col} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
