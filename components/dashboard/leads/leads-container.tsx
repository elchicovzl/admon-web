'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LeadStatus } from '@prisma/client'
import { Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { ClientFormDialog } from '@/components/dashboard/clients/client-form-dialog'
import { useDebouncedValue } from '@/components/dashboard/whatsapp/use-debounced-value'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { convertLead, deleteLead, listLeads, setLeadStatus, updateLead } from '@/lib/actions/lead.actions'
import type { LeadListItem, LeadListPage } from '@/lib/types/lead.types'
import { LEAD_STATUS_LABEL, leadDisplayName, leadToClientDefaults } from '@/lib/whatsapp/leads'
import { LeadEditDialog, type LeadDetails } from './lead-edit-dialog'
import { LeadsTable } from './leads-table'

type Filter = LeadStatus | 'ALL'
const FILTERS: Filter[] = ['ALL', 'NEW', 'CONTACTED', 'CONVERTED', 'DISCARDED']
const SEARCH_DEBOUNCE_MS = 300

/**
 * Leads page (LD-3, LD-4): people who wrote on WhatsApp and are not clients yet. Converting
 * opens the regular client form prefilled from the lead; once the client exists, the lead's
 * contact is linked to it and the lead becomes CONVERTED (S-LD-4).
 */
export function LeadsContainer({ initial }: { initial: LeadListPage }) {
  const [items, setItems] = useState(initial.items)
  const [nextCursor, setNextCursor] = useState(initial.nextCursor)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [search, setSearch] = useState('')
  const query = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [editing, setEditing] = useState<LeadListItem | null>(null)
  const [converting, setConverting] = useState<LeadListItem | null>(null)
  const [deleting, setDeleting] = useState<LeadListItem | null>(null)
  const firstLoad = useRef(true)

  const params = useMemo(
    () => ({ ...(filter === 'ALL' ? {} : { status: filter }), ...(query ? { q: query } : {}) }),
    [filter, query]
  )

  useEffect(() => {
    // The server already rendered the unfiltered first page.
    if (firstLoad.current) {
      firstLoad.current = false
      return
    }
    let cancelled = false
    setLoading(true)
    void listLeads(params)
      .then((result) => {
        if (cancelled) return
        if (!result.success || !result.data) {
          toast.error(result.error ?? 'No se pudieron cargar los leads')
          return
        }
        setItems(result.data.items)
        setNextCursor(result.data.nextCursor)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [params])

  const loadMore = async () => {
    if (!nextCursor) return
    setLoadingMore(true)
    try {
      const result = await listLeads({ ...params, cursor: nextCursor })
      if (!result.success || !result.data) {
        toast.error(result.error ?? 'No se pudieron cargar más leads')
        return
      }
      const page = result.data
      setItems((current) => [...current, ...page.items.filter((item) => !current.some((c) => c.id === item.id))])
      setNextCursor(page.nextCursor)
    } finally {
      setLoadingMore(false)
    }
  }

  const replace = useCallback((lead: LeadListItem) => {
    setItems((current) => current.map((item) => (item.id === lead.id ? lead : item)))
  }, [])

  const runOnLead = async (
    leadId: string,
    task: () => Promise<{ success: boolean; data?: LeadListItem; error?: string }>,
    success: string
  ): Promise<boolean> => {
    setPendingId(leadId)
    try {
      const result = await task()
      if (!result.success || !result.data) {
        toast.error(result.error ?? 'No se pudo completar la acción')
        return false
      }
      replace(result.data)
      toast.success(success)
      return true
    } catch {
      toast.error('No se pudo completar la acción')
      return false
    } finally {
      setPendingId(null)
    }
  }

  const saveDetails = (details: LeadDetails) =>
    editing
      ? runOnLead(editing.id, () => updateLead({ leadId: editing.id, ...details }), 'Lead actualizado')
      : Promise.resolve(false)

  const confirmDelete = async () => {
    const lead = deleting
    setDeleting(null)
    if (!lead) return
    setPendingId(lead.id)
    try {
      const result = await deleteLead({ leadId: lead.id })
      if (!result.success) {
        toast.error(result.error ?? 'No se pudo eliminar el lead')
        return
      }
      setItems((current) => current.filter((item) => item.id !== lead.id))
      toast.success('Lead eliminado')
    } finally {
      setPendingId(null)
    }
  }

  const convertDefaults = useMemo(() => (converting ? leadToClientDefaults(converting) : null), [converting])

  const onClientCreated = (clientId: string) => {
    const lead = converting
    if (!lead) return
    void runOnLead(lead.id, () => convertLead({ leadId: lead.id, clientId }), 'Lead convertido en cliente')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(value) => value && setFilter(value as Filter)}
          className="flex-wrap justify-start"
        >
          {FILTERS.map((value) => (
            <ToggleGroupItem key={value} value={value} size="sm">
              {value === 'ALL' ? 'Todos' : LEAD_STATUS_LABEL[value]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="relative sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o teléfono"
            className="pl-8"
            aria-label="Buscar leads"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="flex items-center justify-center p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-label="Cargando" />
          </div>
        ) : items.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            {query ? `Sin resultados para «${query}»` : 'No hay leads con este filtro.'}
          </p>
        ) : (
          <LeadsTable
            items={items}
            pendingId={pendingId}
            onEdit={setEditing}
            onSetStatus={(lead, status) =>
              void runOnLead(
                lead.id,
                () => setLeadStatus({ leadId: lead.id, status }),
                `Lead marcado como ${LEAD_STATUS_LABEL[status].toLowerCase()}`
              )
            }
            onConvert={setConverting}
            onDelete={setDeleting}
          />
        )}
      </div>

      {nextCursor && !loading && (
        <div className="text-center">
          <Button type="button" variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            Cargar más
          </Button>
        </div>
      )}

      <LeadEditDialog
        lead={editing}
        pending={editing !== null && pendingId === editing.id}
        onOpenChange={(open) => !open && setEditing(null)}
        onSave={saveDetails}
      />

      <ClientFormDialog
        open={converting !== null}
        onOpenChange={(open) => !open && setConverting(null)}
        createDefaults={convertDefaults}
        redirectOnCreate={false}
        onClientCreated={(client) => onClientCreated(client.id)}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este lead?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? leadDisplayName(deleting) : ''} dejará de aparecer como lead y no se volverá a crear
              aunque escriba de nuevo. La conversación de WhatsApp se conserva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
