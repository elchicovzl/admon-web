/**
 * Empty state for the purchase invoices list.
 *
 * With a date filter active the range is walked in full
 * (`lib/alegra/date-range-walk.ts`), so "zero results" means the range really
 * is empty — not that matches fell outside the one page we happened to fetch.
 */

import Link from 'next/link'
import { FileSearch, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface BillEmptyStateProps {
  hasActiveFilters: boolean
  filtersCount: number
}

export function BillEmptyState({ hasActiveFilters, filtersCount }: BillEmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <FileSearch className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">
            {hasActiveFilters
              ? 'No hay facturas de compra que coincidan con los filtros'
              : 'No hay facturas de compra registradas'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters ? (
              <>
                Probá ampliando el rango de fechas, quitando algún filtro
                {filtersCount > 0 ? ` (${filtersCount} activos)` : ''}, o buscando por otro proveedor.
              </>
            ) : (
              'Cuando registres tu primera factura de proveedor en Alegra, aparecerá acá.'
            )}
          </p>
        </div>
        {hasActiveFilters && (
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/dashboard/finances/bills">
              <X className="mr-2 h-3.5 w-3.5" />
              Limpiar filtros
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
