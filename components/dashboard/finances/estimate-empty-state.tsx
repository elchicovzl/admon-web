/**
 * Empty state shown when the estimate list has zero results — either the
 * Alegra company genuinely has no estimates, the active date-range filter
 * excluded everything from the fetched page, or the client name search
 * didn't match.
 *
 * Note: estimates can be empty both because the company never issued one
 * and because the client-side date-range filter (see `filterEstimatesByDateRange`)
 * excluded everything from the fetched page. We distinguish by checking
 * `hasActiveFilters`: if no filters, the company has no estimates yet; if
 * filters are set, the filters are too restrictive.
 */

import Link from 'next/link'
import { FileSearch, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface EstimateEmptyStateProps {
  hasActiveFilters: boolean
  filtersCount: number
}

export function EstimateEmptyState({ hasActiveFilters, filtersCount }: EstimateEmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <FileSearch className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">
            {hasActiveFilters
              ? 'No hay cotizaciones que coincidan con los filtros'
              : 'No hay cotizaciones registradas'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters ? (
              <>
                Probá ampliando el rango de fechas (recordá que se filtra en el
                navegador), quitando algún filtro
                {filtersCount > 0 ? ` (${filtersCount} activos)` : ''}, o buscando por otro cliente.
              </>
            ) : (
              'Cuando emitas tu primera cotización en Alegra, aparecerá acá.'
            )}
          </p>
        </div>
        {hasActiveFilters && (
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/dashboard/finances/estimates">
              <X className="mr-2 h-3.5 w-3.5" />
              Limpiar filtros
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}