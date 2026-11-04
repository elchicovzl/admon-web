/**
 * Disability Sub-processes Table
 * One highlighted row per INCAPACIDADES sub-process, shown in the affiliations
 * list when "Incapacidades" is the only sub-process filter.
 */

'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, HeartPulse, Loader2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { AffiliationProcessType } from '@prisma/client'
import { AffiliationProcessTypeLabels } from '@/lib/types/affiliation.types'
import type { AffiliationWithRelations } from '@/lib/types/affiliation.types'
import { buildDisabilityRows, daysSince, disabilityDays } from '@/lib/utils/disability-rows'
import { StatusBadge } from './status-badge'
import { CheckCell, fmtDate } from './disability-cells'

const PAGE_SIZE = 10

interface DisabilitySubProcessesTableProps {
  affiliations: AffiliationWithRelations[]
  searchQuery?: string
}

export function DisabilitySubProcessesTable({
  affiliations,
  searchQuery = '',
}: DisabilitySubProcessesTableProps) {
  const router = useRouter()
  const [isNavigating, startTransition] = useTransition()
  const [currentPage, setCurrentPage] = useState(1)

  const rows = useMemo(() => buildDisabilityRows(affiliations, searchQuery), [affiliations, searchQuery])

  useEffect(() => {
    setCurrentPage(1)
  }, [rows])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedRows = rows.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE)

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No hay sub-procesos de incapacidad</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border relative">
      {isNavigating && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
          <div className="flex items-center gap-3 bg-card border shadow-lg rounded-lg px-6 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Cargando sub-proceso...</span>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 border-b bg-rose-50 px-4 py-2 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
        <HeartPulse className="h-4 w-4" />
        Mostrando {rows.length} sub-proceso{rows.length === 1 ? '' : 's'} de incapacidad
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Proceso</TableHead>
            <TableHead>Tipo de Proceso</TableHead>
            <TableHead>Empleado</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Días en proceso</TableHead>
            <TableHead>Inicio incap.</TableHead>
            <TableHead>Fin incap.</TableHead>
            <TableHead>Días incap.</TableHead>
            <TableHead>Reg. Banco</TableHead>
            <TableHead>Transcripción</TableHead>
            <TableHead>Cobro</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedRows.map(({ affiliation, subProcess }) => {
            const processType = affiliation.processType
            const processLabel = processType
              ? processType === AffiliationProcessType.OTRO && affiliation.processTypeOther
                ? affiliation.processTypeOther
                : AffiliationProcessTypeLabels[processType]
              : '—'
            const days = disabilityDays(subProcess.disabilityStartDate, subProcess.disabilityEndDate)

            return (
              <TableRow
                key={subProcess.id}
                className="cursor-pointer bg-rose-50/60 hover:bg-rose-100/70 dark:bg-rose-950/20 dark:hover:bg-rose-950/40"
                onClick={() =>
                  startTransition(() =>
                    router.push(`/dashboard/affiliations/${affiliation.id}/subprocess/${subProcess.id}`)
                  )
                }
              >
                <TableCell className="max-w-[240px] border-l-4 border-l-rose-400">
                  <span className="font-mono text-sm font-bold">{affiliation.affiliationNumber}</span>
                  <div className="text-sm text-muted-foreground truncate" title={affiliation.client?.fullName}>
                    {affiliation.client?.fullName}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm max-w-[180px]">{processLabel}</div>
                </TableCell>
                <TableCell>
                  <span className="text-sm truncate block max-w-[200px]" title={subProcess.employee?.fullName}>
                    {subProcess.employee?.fullName ?? <span className="text-muted-foreground italic">—</span>}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={subProcess.status} />
                </TableCell>
                <TableCell className="text-xs">
                  {daysSince(affiliation.startDate ?? subProcess.createdAt) ?? '—'}
                </TableCell>
                <TableCell className="text-xs">{fmtDate(subProcess.disabilityStartDate)}</TableCell>
                <TableCell className="text-xs">{fmtDate(subProcess.disabilityEndDate)}</TableCell>
                <TableCell className="text-xs">{days ?? '—'}</TableCell>
                <TableCell><CheckCell value={subProcess.bankRegistry} /></TableCell>
                <TableCell><CheckCell value={subProcess.transcription} /></TableCell>
                <TableCell><CheckCell value={subProcess.collection} /></TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {rows.length > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {(safeCurrentPage - 1) * PAGE_SIZE + 1}-{Math.min(safeCurrentPage * PAGE_SIZE, rows.length)} de {rows.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              {safeCurrentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
