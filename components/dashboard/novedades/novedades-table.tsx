'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Pencil, CalendarX2 } from 'lucide-react'
import { NovedadType } from '@prisma/client'
import type { NovedadListItem } from '@/lib/types/novedad.types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  NOVEDAD_TYPE_LABELS,
  NOVEDAD_TYPE_BADGE,
} from '@/components/dashboard/novedades/novedad-meta'
import { DeleteNovedadDialog } from '@/components/dashboard/novedades/delete-novedad-dialog'

interface NovedadesTableProps {
  novedades: NovedadListItem[]
  onEdit: (novedad: NovedadListItem) => void
  /** Si se pasa, oculta la columna de empleado (vista de un solo empleado). */
  hideEmployee?: boolean
}

function formatPeriod(novedad: NovedadListItem): string {
  const start = format(new Date(novedad.startDate), 'dd/MM/yyyy', { locale: es })
  const end = format(new Date(novedad.endDate), 'dd/MM/yyyy', { locale: es })
  const range = start === end ? start : `${start} → ${end}`
  if (novedad.unit === 'HORAS' && novedad.hours != null) {
    return `${range} · ${novedad.hours}h`
  }
  return range
}

export function NovedadesTable({ novedades, onEdit, hideEmployee }: NovedadesTableProps) {
  if (novedades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <CalendarX2 className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="font-medium">No hay novedades para mostrar</p>
        <p className="text-sm text-muted-foreground">
          Registrá una vacación, permiso o calamidad para empezar.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {!hideEmployee && <TableHead>Empleado</TableHead>}
            <TableHead>Tipo</TableHead>
            <TableHead>Periodo</TableHead>
            <TableHead className="text-center">Días desc.</TableHead>
            <TableHead>Observación</TableHead>
            <TableHead className="w-24 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {novedades.map((novedad) => (
            <TableRow key={novedad.id}>
              {!hideEmployee && (
                <TableCell className="font-medium">
                  <Link
                    href={`/dashboard/novedades/${novedad.user.id}`}
                    className="hover:underline"
                  >
                    {novedad.user.name || novedad.user.email}
                  </Link>
                </TableCell>
              )}
              <TableCell>
                <Badge variant={NOVEDAD_TYPE_BADGE[novedad.type]}>
                  {NOVEDAD_TYPE_LABELS[novedad.type]}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {formatPeriod(novedad)}
              </TableCell>
              <TableCell className="text-center">
                {novedad.type === NovedadType.VACACIONES ||
                novedad.vacationDaysDeducted > 0 ? (
                  <span className="font-semibold">{novedad.vacationDaysDeducted}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="max-w-xs">
                <span className="line-clamp-1 text-sm text-muted-foreground">
                  {novedad.observation || '—'}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(novedad)}
                    aria-label="Editar novedad"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <DeleteNovedadDialog
                    novedadId={novedad.id}
                    label={`${NOVEDAD_TYPE_LABELS[novedad.type]} de ${
                      novedad.user.name || novedad.user.email
                    }`}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
