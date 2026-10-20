'use client'

import { useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { searchClientsForLink } from '@/lib/actions/whatsapp.actions'
import type { ClientLinkOption } from '@/lib/types/whatsapp.types'
import { useDebouncedValue } from './use-debounced-value'

interface LinkClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The contact's phone, shown so the user can compare it with the candidates. */
  phone: string
  pending: boolean
  onLink: (clientId: string) => Promise<boolean>
}

const SEARCH_DEBOUNCE_MS = 300

/**
 * Manual link (LD-5). The user searches an active client by name, document or phone and picks
 * one; the link is locked, so automatic matching never changes it afterwards.
 */
export function LinkClientDialog({ open, onOpenChange, phone, pending, onLink }: LinkClientDialogProps) {
  const [text, setText] = useState('')
  const [results, setResults] = useState<ClientLinkOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const query = useDebouncedValue(text, SEARCH_DEBOUNCE_MS)

  useEffect(() => {
    if (!open) {
      setText('')
      setResults([])
      setSelectedId(null)
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (!open || !query.trim()) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    void searchClientsForLink({ q: query })
      .then((result) => {
        if (cancelled) return
        setResults(result.success ? (result.data ?? []) : [])
        setError(result.success ? null : (result.error ?? 'No se pudo buscar'))
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [open, query])

  const submit = async () => {
    if (!selectedId) return
    if (await onLink(selectedId)) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular a un cliente</DialogTitle>
          <DialogDescription>
            Busque el cliente al que pertenece el número {phone}. El vínculo manual no se cambia automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Nombre, documento o teléfono"
            className="pl-8"
            aria-label="Buscar cliente"
          />
        </div>

        <div className="max-h-72 min-h-24 overflow-y-auto rounded-md border" role="listbox" aria-label="Clientes">
          {loading ? (
            <div className="flex items-center justify-center p-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-label="Buscando" />
            </div>
          ) : error ? (
            <p className="p-4 text-sm text-destructive">{error}</p>
          ) : results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {query.trim() ? `Sin resultados para «${query.trim()}»` : 'Escriba para buscar un cliente.'}
            </p>
          ) : (
            results.map((client) => (
              <button
                key={client.id}
                type="button"
                role="option"
                aria-selected={selectedId === client.id}
                onClick={() => setSelectedId(client.id)}
                className={`flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent ${
                  selectedId === client.id ? 'bg-accent' : ''
                }`}
              >
                <span className="font-medium">{client.fullName}</span>
                <span className="text-xs text-muted-foreground">
                  Doc. {client.identificationNumber} · Tel. {client.phone}
                </span>
              </button>
            ))
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!selectedId || pending} onClick={() => void submit()}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
