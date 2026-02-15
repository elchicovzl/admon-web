import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ClientDocumentsGallerySkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Documentos del Cliente</CardTitle>
        <CardDescription>Cargando galería de documentos...</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload area skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-[200px] w-full rounded-lg" />
        </div>

        {/* Documents grid skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[280px] rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
