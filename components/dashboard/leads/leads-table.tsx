'use client'

import Link from 'next/link'
import type { LeadStatus } from '@prisma/client'
import { MessageCircle, MoreHorizontal, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { LeadListItem } from '@/lib/types/lead.types'
import { LEAD_STATUS_LABEL, leadDisplayName } from '@/lib/whatsapp/leads'

const STATUS_VARIANT: Record<LeadStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  NEW: 'default',
  CONTACTED: 'secondary',
  CONVERTED: 'outline',
  DISCARDED: 'outline',
}

const dateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'America/Bogota' })

export interface LeadRowHandlers {
  onEdit: (lead: LeadListItem) => void
  onSetStatus: (lead: LeadListItem, status: 'NEW' | 'CONTACTED' | 'DISCARDED') => void
  onConvert: (lead: LeadListItem) => void
  onDelete: (lead: LeadListItem) => void
}

interface LeadsTableProps extends LeadRowHandlers {
  items: LeadListItem[]
  pendingId: string | null
}

export function LeadsTable({ items, pendingId, onEdit, onSetStatus, onConvert, onDelete }: LeadsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Teléfono</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="hidden md:table-cell">Notas</TableHead>
          <TableHead className="hidden sm:table-cell">Creado</TableHead>
          <TableHead className="w-0" aria-label="Acciones" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((lead) => {
          const converted = lead.status === 'CONVERTED'
          return (
            <TableRow key={lead.id}>
              <TableCell className="font-medium">
                {converted && lead.convertedClient ? (
                  <Link href={`/dashboard/clients/${lead.convertedClient.id}`} className="hover:underline">
                    {lead.convertedClient.fullName}
                  </Link>
                ) : (
                  leadDisplayName(lead)
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">{lead.phoneE164}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[lead.status]}>{LEAD_STATUS_LABEL[lead.status]}</Badge>
              </TableCell>
              <TableCell className="hidden max-w-xs truncate text-muted-foreground md:table-cell">
                {lead.notes ?? '—'}
              </TableCell>
              <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                {dateFormat.format(new Date(lead.createdAt))}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  {lead.conversationId && (
                    <Button asChild size="icon" variant="ghost" aria-label="Ver conversación">
                      <Link href={`/dashboard/whatsapp?c=${lead.conversationId}`}>
                        <MessageCircle className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                  {!converted && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pendingId === lead.id}
                      onClick={() => onConvert(lead)}
                    >
                      <UserPlus className="h-4 w-4" />
                      Convertir
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={pendingId === lead.id}
                        aria-label="Más acciones"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onEdit(lead)}>Editar datos</DropdownMenuItem>
                      {!converted &&
                        (['NEW', 'CONTACTED', 'DISCARDED'] as const)
                          .filter((status) => status !== lead.status)
                          .map((status) => (
                            <DropdownMenuItem key={status} onSelect={() => onSetStatus(lead, status)}>
                              Marcar como {LEAD_STATUS_LABEL[status].toLowerCase()}
                            </DropdownMenuItem>
                          ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => onDelete(lead)}
                      >
                        Eliminar lead
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
