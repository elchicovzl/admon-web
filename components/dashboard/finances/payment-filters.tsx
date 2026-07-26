'use client'

/**
 * Filters for the payments list.
 *
 * `type` (in/out) is a native /payments filter. The date range is NOT —
 * /payments has NO date filter of any kind, so any date-scoped query walks
 * pages (`lib/alegra/date-range-walk.ts`). There is no single-page shortcut
 * to fall back on here, unlike bills and estimates.
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { X, Loader2 } from 'lucide-react'
import type { PaymentFilters } from '@/lib/alegra/transformers'
import { cn } from '@/lib/utils'

interface PaymentFiltersBarProps {
  initial: PaymentFilters
}

const TYPE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'in', label: 'Cobros' },
  { value: 'out', label: 'Pagos' },
] as const

export function PaymentFiltersBar({ initial }: PaymentFiltersBarProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function buildSearch(overrides: Partial<PaymentFilters> = {}): string {
    const params = new URLSearchParams()

    const type = overrides.type !== undefined ? overrides.type : initial.type
    if (type) params.set('type', type)

    const dateFrom = overrides.dateFrom !== undefined ? overrides.dateFrom : initial.dateFrom
    if (dateFrom) params.set('date_from', dateFrom)

    const dateTo = overrides.dateTo !== undefined ? overrides.dateTo : initial.dateTo
    if (dateTo) params.set('date_to', dateTo)

    // page intentionally omitted — any filter change resets to page 1.
    const s = params.toString()
    return s.length > 0 ? `?${s}` : ''
  }

  function navigate(search: string) {
    startTransition(() => {
      router.push(`/dashboard/finances/payments${search}`)
    })
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    navigate(
      buildSearch({
        dateFrom: fd.get('date_from')?.toString().trim() || null,
        dateTo: fd.get('date_to')?.toString().trim() || null,
      }),
    )
  }

  const activeCount =
    (initial.type ? 1 : 0) + (initial.dateFrom ? 1 : 0) + (initial.dateTo ? 1 : 0)

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Dirección
          </Label>
          <div className="flex gap-1 rounded-md border p-1">
            {TYPE_OPTIONS.map((opt) => {
              const isActive = (initial.type ?? '') === opt.value
              return (
                <button
                  key={opt.value || 'all'}
                  type="button"
                  onClick={() =>
                    navigate(buildSearch({ type: opt.value === '' ? null : opt.value }))
                  }
                  className={cn(
                    'rounded px-3 py-1 text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
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
