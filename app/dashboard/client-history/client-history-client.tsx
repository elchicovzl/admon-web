'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search } from 'lucide-react'
import { ClientHistoryTable } from '@/components/dashboard/client-history/client-history-table'
import type { ClientHistoryListItem } from '@/lib/types/client-history.types'

type StatusFilter = 'active' | 'deleted' | 'all'

interface ClientHistoryClientProps {
  initialClients: ClientHistoryListItem[]
}

export function ClientHistoryClient({ initialClients }: ClientHistoryClientProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()

    return initialClients.filter((client) => {
      if (statusFilter === 'active' && client.isDeleted) return false
      if (statusFilter === 'deleted' && !client.isDeleted) return false

      if (!term) return true
      return (
        client.fullName.toLowerCase().includes(term) ||
        client.identificationNumber.toLowerCase().includes(term) ||
        client.email.toLowerCase().includes(term) ||
        (client.company?.fullName.toLowerCase().includes(term) ?? false)
      )
    })
  }, [initialClients, search, statusFilter])

  const deletedCount = useMemo(
    () => initialClients.filter((c) => c.isDeleted).length,
    [initialClients]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, identificación, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos ({initialClients.length})</SelectItem>
            <SelectItem value="active">
              Activos ({initialClients.length - deletedCount})
            </SelectItem>
            <SelectItem value="deleted">Eliminados ({deletedCount})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ClientHistoryTable clients={filtered} />
    </div>
  )
}
