'use client'

/**
 * Filters for the invoices list page.
 *
 * URL-driven: changes are pushed to the URL via `router.push()`, which triggers
 * a re-render of the Server Component that re-fetches invoices from Alegra.
 *
 * State is held in form fields (uncontrolled inputs). The submit handler
 * builds a URLSearchParams from FormData and navigates.
 *
 * Auto-submit is enabled for checkboxes (status) and date inputs (instant
 * feedback), but the search input requires an explicit submit (so users can
 * type "ACME S.A.S" before submitting, without 4 navigations per word).
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Search, X, Loader2 } from 'lucide-react'
import type { InvoiceFilters, InvoiceStatus } from '@/lib/alegra/transformers'
import { INVOICE_STATUS_LABELS } from '@/lib/alegra/transformers'

interface InvoiceFiltersBarProps {
  initial: InvoiceFilters
}

const STATUS_OPTIONS: InvoiceStatus[] = ['open', 'closed', 'draft', 'void']

export function InvoiceFiltersBar({ initial }: InvoiceFiltersBarProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function buildSearchString(form: HTMLFormElement): string {
    const fd = new FormData(form)
    const params = new URLSearchParams()

    // status: emit one ?status= per checked box
    for (const s of fd.getAll('status')) {
      params.append('status', s.toString())
    }

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
      router.push(`/dashboard/finances/invoices${search}`)
    })
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    navigate(buildSearchString(e.currentTarget))
  }

  function onAutoSubmitChange(e: React.FormEvent<HTMLFormElement>) {
    // Submit only when the change comes from a checkbox or date input
    const target = e.target as HTMLElement
    if (
      target instanceof HTMLInputElement &&
      (target.type === 'checkbox' || target.type === 'date')
    ) {
      // do NOT preventDefault — let the form submit naturally? No: we need to
      // prevent the default form submission to handle the URL push ourselves.
      e.preventDefault()
      navigate(buildSearchString(e.currentTarget))
    }
  }

  function clearFilters() {
    navigate('')
  }

  const activeCount =
    initial.status.length +
    (initial.dateFrom ? 1 : 0) +
    (initial.dateTo ? 1 : 0) +
    (initial.clientName ? 1 : 0)

  return (
    <form
      onSubmit={onSubmit}
      onChange={onAutoSubmitChange}
      className="space-y-4 rounded-lg border bg-card p-4"
    >
      {/* Row 1: status checkboxes + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Estado
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_OPTIONS.map((status) => {
              const checked = initial.status.includes(status)
              return (
                <label
                  key={status}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    checked
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-input bg-background hover:bg-accent'
                  }`}
                >
                  <input
                    type="checkbox"
                    name="status"
                    value={status}
                    defaultChecked={checked}
                    className="h-3 w-3 accent-primary"
                  />
                  {INVOICE_STATUS_LABELS[status]}
                </label>
              )
            })}
            {activeCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="ml-auto h-7 gap-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Limpiar
              </Button>
            )}
          </div>
        </div>

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
      </div>

      {/* Row 2: date range + actions */}
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
