/**
 * Highlighted row rendered under an affiliation for each of its INCAPACIDADES
 * sub-processes, so disability data is visible without filtering.
 */

'use client'

import type { ReactNode } from 'react'
import { CornerDownRight, HeartPulse } from 'lucide-react'
import { TableCell, TableRow } from '@/components/ui/table'
import type { DisabilityRow } from '@/lib/utils/disability-rows'
import { daysSince, disabilityDays } from '@/lib/utils/disability-rows'
import { StatusBadge } from './status-badge'
import { CheckCell, fmtDate } from './disability-cells'

interface DisabilitySubRowProps {
  row: DisabilityRow
  colSpan: number
  onOpen: (affiliationId: string, subProcessId: string) => void
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-rose-700/80 dark:text-rose-300/80">{label}</span>
      <span className="flex h-5 items-center text-xs">{children}</span>
    </div>
  )
}

export function DisabilitySubRow({ row, colSpan, onOpen }: DisabilitySubRowProps) {
  const { affiliation, subProcess } = row
  const days = disabilityDays(subProcess.disabilityStartDate, subProcess.disabilityEndDate)

  return (
    <TableRow
      className="cursor-pointer bg-rose-50/60 hover:bg-rose-100/70 dark:bg-rose-950/20 dark:hover:bg-rose-950/40"
      onClick={() => onOpen(affiliation.id, subProcess.id)}
    >
      <TableCell colSpan={colSpan} className="border-l-4 border-l-rose-400 py-2">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pl-2">
          <div className="flex items-center gap-1.5 text-sm font-medium text-rose-800 dark:text-rose-300">
            <CornerDownRight className="h-4 w-4" />
            <HeartPulse className="h-4 w-4" />
            Incapacidad
            {subProcess.employee?.fullName && (
              <span className="max-w-[200px] truncate font-normal text-muted-foreground" title={subProcess.employee.fullName}>
                · {subProcess.employee.fullName}
              </span>
            )}
          </div>
          <StatusBadge status={subProcess.status} />
          <Field label="Días en proceso">{daysSince(affiliation.startDate ?? subProcess.createdAt) ?? '—'}</Field>
          <Field label="Inicio incap.">{fmtDate(subProcess.disabilityStartDate)}</Field>
          <Field label="Fin incap.">{fmtDate(subProcess.disabilityEndDate)}</Field>
          <Field label="Días incap.">{days ?? '—'}</Field>
          <Field label="Reg. Banco"><CheckCell value={subProcess.bankRegistry} /></Field>
          <Field label="Transcripción"><CheckCell value={subProcess.transcription} /></Field>
          <Field label="Cobro"><CheckCell value={subProcess.collection} /></Field>
        </div>
      </TableCell>
    </TableRow>
  )
}
