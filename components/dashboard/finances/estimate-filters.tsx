'use client'

/**
 * Filters for the estimates list page.
 *
 * URL-driven: changes are pushed to the URL via `router.push()`, which triggers
 * a re-render of the Server Component that re-fetches estimates from Alegra.
 *
 * IMPORTANT — NO status checkboxes here. Estimates don't have a status field
 * on the Alegra API (see `EstimateListItemSchema`). Only date range + client
 * name filters, which is what `/estimates` supports natively (date range is
 * applied client-side after fetch — see `filterEstimatesByDateRange`).
 *
 * State is held in form fields (uncontrolled inputs). The submit handler
 * builds a URLSearchParams from FormData and navigates.
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Search, X, Loader2 } from 'lucide-react'
import type { EstimateFilters } from '@/lib/alegra/transformers'

interface EstimateFiltersBarProps {
  initial: EstimateFilters
}

export function EstimateFiltersBar({ initial }: EstimateFiltersBarProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function buildSearchString(form: HTMLFormElement): string {
    const fd = new FormData(form)
    const params = new URLSearchParams()

    const dateFrom = fd.get('date_from')?.toString().trim()
    if (dateFrom) params.set('date_from', dateFrom)

    const dateTo = fd.get('date_to')?.toString().trim()
    if (dateTo) params.set('date_to', dateTo)

    const clientName = fd.get('client_name')?.toString().trim()
    if (clientName) params.set('client_name', clientName)

    // page is reset on every filter change
    const s = params.toString()
    return s.length > 0 ? `?${s}` : ''
  }

  function navigate(search: string) {
    startTransition(() => {
      router.push(`/dashboard/finances/estimates${search}`)
    })
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    navigate(buildSearchString(e.currentTarget))
  }

  function onAutoSubmitChange(e: React.FormEvent<HTMLFormElement>) {
    // Auto-submit when the change comes from a date input (instant feedback).
    // Search input keeps explicit submit so users can type the full name first.
    const target = e.target as HTMLElement
    if (target instanceof HTMLInputElement && target.type === 'date') {
      e.preventDefault()
      navigate(buildSearchString(e.currentTarget))
    }
  }

  function clearFilters() {
    navigate('')
  }

  const activeCount =
    (initial.dateFrom ? 1 : 0) +
    (initial.dateTo ? 1 : 0) +
    (initial.clientName ? 1 : 0)

  return (
    <form
      onSubmit={onSubmit}
      onChange={onAutoSubmitChange}
      className="space-y-4 rounded-lg border bg-card p-4"
    >
      {/* Row 1: client search (no status checkboxes — estimates have no status) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2 sm:w-72">
          <Label htmlFor="client_name" className="text-xs uppercase tracking-wide text-muted-foreground">
            Cliente
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="client_name"
              name="client_name"
              type="search"
              placeholder="Buscar por nombre…"
              defaultValue={initial.clientName ?? ''}
              className="pl-8"
            />
          </div>
        </div>

        {activeCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-7 gap-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Row 2: date range + apply */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
          <div className="space-y-1.5">
            <Label htmlFor="date_from" className="text-xs">
              Desde
            </Label>
            <Input
              id="date_from"
              name="date_from"
              type="date"
              defaultValue={initial.dateFrom ?? ''}
              max={initial.dateTo ?? undefined}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date_to" className="text-xs">
              Hasta
            </Label>
            <Input
              id="date_to"
              name="date_to"
              type="date"
              defaultValue={initial.dateTo ?? ''}
              min={initial.dateFrom ?? undefined}
            />
          </div>
        </div>

        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground sm:max-w-xs sm:flex-1">
          ⚠️ El filtro de fechas se aplica en el navegador sobre los resultados
          de Alegra (la API de cotizaciones no soporta rangos de fecha).
        </div>

        <Button type="submit" disabled={pending} className="sm:ml-auto">
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Aplicar filtros
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeCount}
            </Badge>
          )}
        </Button>
      </div>
    </form>
  )
}