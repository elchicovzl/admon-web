'use client'

/**
 * Filters for the purchase invoices list.
 *
 * URL-driven: changes are pushed to the URL, which re-renders the Server
 * Component that re-reads from Alegra.
 *
 * `status` and `provider_name` are native /bills filters. The date range is
 * NOT — activating it switches the page to a paginated walk of the range
 * (`lib/alegra/date-range-walk.ts`) instead of one server-paginated page.
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, X, Loader2 } from 'lucide-react'
import type { BillFilters } from '@/lib/alegra/transformers'
import { BILL_STATUS_LABELS } from '@/lib/alegra/transformers'
import type { BillStatus } from '@/lib/alegra/types'

const STATUSES: BillStatus[] = ['open', 'closed', 'void']

interface BillFiltersBarProps {
  initial: BillFilters
}

export function BillFiltersBar({ initial }: BillFiltersBarProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function buildSearchString(form: HTMLFormElement): string {
    const fd = new FormData(form)
    const params = new URLSearchParams()

    for (const status of fd.getAll('status')) {
      const s = status.toString().trim()
      if (s) params.append('status', s)
    }

    const dateFrom = fd.get('date_from')?.toString().trim()
    if (dateFrom) params.set('date_from', dateFrom)

    const dateTo = fd.get('date_to')?.toString().trim()
    if (dateTo) params.set('date_to', dateTo)

    const providerName = fd.get('provider_name')?.toString().trim()
    if (providerName) params.set('provider_name', providerName)

    // page intentionally omitted — any filter change resets to page 1.
    const s = params.toString()
    return s.length > 0 ? `?${s}` : ''
  }

  function navigate(search: string) {
    startTransition(() => {
      router.push(`/dashboard/finances/bills${search}`)
    })
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    navigate(buildSearchString(e.currentTarget))
  }

  function onAutoSubmitChange(e: React.FormEvent<HTMLFormElement>) {
    // Dates and checkboxes apply instantly; the free-text search waits for
    // an explicit submit so the user can finish typing a provider name.
    const target = e.target as HTMLElement
    const isDate = target instanceof HTMLInputElement && target.type === 'date'
    const isCheckbox = target.getAttribute('role') === 'checkbox'

    if (isDate || isCheckbox) {
      e.preventDefault()
      navigate(buildSearchString(e.currentTarget))
    }
  }

  const activeCount =
    initial.status.length +
    (initial.dateFrom ? 1 : 0) +
    (initial.dateTo ? 1 : 0) +
    (initial.providerName ? 1 : 0)

  return (
    <form
      onSubmit={onSubmit}
      onChange={onAutoSubmitChange}
      className="space-y-4 rounded-lg border bg-card p-4"
    >
      {/* Row 1: provider search + status */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2 sm:w-72">
          <Label
            htmlFor="provider_name"
            className="text-xs uppercase tracking-wide text-muted-foreground"
          >
            Proveedor
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="provider_name"
              name="provider_name"
              type="search"
              placeholder="Buscar por nombre…"
              defaultValue={initial.providerName ?? ''}
              className="pl-8"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Estado</Label>
          <div className="flex flex-wrap gap-3">
            {STATUSES.map((status) => (
              <label key={status} className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  name="status"
                  value={status}
                  defaultChecked={initial.status.includes(status)}
                />
                <span>{BILL_STATUS_LABELS[status]}</span>
              </label>
            ))}
          </div>
        </div>

        {activeCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('')}
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
