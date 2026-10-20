import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ConversationSummary } from '@/lib/types/whatsapp.types'
import {
  MARKER_LABEL,
  STATUS_LABEL,
  attentionLabel,
  formatBadgeCount,
  formatListTime,
  listPreview,
} from '@/lib/whatsapp/inbox'
import { ConversationListSkeleton } from './inbox-skeletons'

export type InboxFilter = 'ALL' | ConversationSummary['status']

const FILTERS: { value: InboxFilter; label: string }[] = [
  { value: 'ALL', label: 'Todas' },
  { value: 'ESCALATED', label: 'Escaladas' },
  { value: 'HUMAN', label: 'Asesor' },
  { value: 'AI', label: 'IA' },
  { value: 'CLOSED', label: 'Cerradas' },
]

interface ConversationRowProps {
  item: ConversationSummary
  selected: boolean
  now: Date | null
  onSelect: (id: string) => void
}

function ConversationRow({ item, selected, now, onSelect }: ConversationRowProps) {
  const escalated = item.status === 'ESCALATED'
  const attention = now ? attentionLabel(item, now) : null

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'flex w-full flex-col gap-1 border-l-4 border-transparent px-3 py-2.5 text-left transition-colors hover:bg-accent/60',
          escalated && 'border-l-destructive bg-destructive/5',
          selected && 'bg-accent'
        )}
      >
        <span className="flex items-center justify-between gap-2">
          <span className={cn('truncate text-sm', item.unreadCount > 0 ? 'font-semibold' : 'font-medium')}>
            {item.displayName}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {now ? formatListTime(item.lastMessageAt, now) : ''}
          </span>
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">{listPreview(item.preview)}</span>
          {item.unreadCount > 0 && (
            <span
              className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground"
              aria-label={`${item.unreadCount} sin leer`}
            >
              {formatBadgeCount(item.unreadCount)}
            </span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-1">
          <Badge variant={escalated ? 'destructive' : 'secondary'}>{STATUS_LABEL[item.status]}</Badge>
          {item.aiPaused && <Badge variant="outline">IA pausada</Badge>}
          {item.markers.map((marker) => (
            <Badge key={marker} variant="outline">
              {MARKER_LABEL[marker]}
            </Badge>
          ))}
          {attention && <span className="text-xs font-medium text-destructive">{attention}</span>}
        </span>
      </button>
    </li>
  )
}

interface ConversationListProps {
  items: ConversationSummary[]
  filter: InboxFilter
  onFilterChange: (filter: InboxFilter) => void
  selectedId: string | null
  onSelect: (id: string) => void
  loading: boolean
  error: string | null
  onRetry: () => void
  canLoadMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  now: Date | null
}

export function ConversationList({
  items,
  filter,
  onFilterChange,
  selectedId,
  onSelect,
  loading,
  error,
  onRetry,
  canLoadMore,
  loadingMore,
  onLoadMore,
  now,
}: ConversationListProps) {
  // Polling can bring in rows of other states; the filter is applied here as well.
  const visible = filter === 'ALL' ? items : items.filter((item) => item.status === filter)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* One row: compact chips that scroll sideways instead of wrapping when the pane is narrow. */}
      <div
        className="flex flex-nowrap gap-1 overflow-x-auto border-b p-2"
        role="group"
        aria-label="Filtrar por estado"
      >
        {FILTERS.map(({ value, label }) => (
          <Button
            key={value}
            type="button"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            variant={filter === value ? 'default' : 'outline'}
            aria-pressed={filter === value}
            onClick={() => onFilterChange(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <ConversationListSkeleton />
        ) : error ? (
          <div className="space-y-2 p-4 text-sm">
            <p className="text-destructive">{error}</p>
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              Reintentar
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No hay conversaciones.</p>
        ) : (
          <>
            <ul className="divide-y">
              {visible.map((item) => (
                <ConversationRow
                  key={item.id}
                  item={item}
                  selected={item.id === selectedId}
                  now={now}
                  onSelect={onSelect}
                />
              ))}
            </ul>
            {canLoadMore && (
              <div className="p-3 text-center">
                <Button type="button" size="sm" variant="ghost" disabled={loadingMore} onClick={onLoadMore}>
                  {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                  Cargar más
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
