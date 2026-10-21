'use client'

import { useState, useTransition } from 'react'
import { BarChart3 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getUsageSummary } from '@/lib/actions/whatsapp.actions'
import type { AiUsageSummary } from '@/lib/types/whatsapp.types'

const numberFormat = new Intl.NumberFormat('es-CO')
const usdFormat = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 })

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

/**
 * AI usage of the last 30 days (AI-13): turn outcomes, tokens, audio minutes and estimated
 * cost per day. Loaded when opened; it never shows conversation content.
 */
export function AiUsageSummaryDialog() {
  const [summary, setSummary] = useState<AiUsageSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const load = (open: boolean) => {
    if (!open) return
    startTransition(async () => {
      const result = await getUsageSummary({})
      if (!result.success || !result.data) {
        setError(result.error ?? 'No se pudo cargar el uso de IA')
        return
      }
      setError(null)
      setSummary(result.data)
    })
  }

  const totals = summary?.totals

  return (
    <Dialog onOpenChange={load}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BarChart3 className="h-4 w-4" />
          Uso de IA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Uso de IA</DialogTitle>
          <DialogDescription>Últimos 30 días, por día (hora de Colombia). El costo es estimado.</DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {pending && !summary ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : totals ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Turnos" value={numberFormat.format(totals.turns)} />
              <Stat label="Respondidos" value={numberFormat.format(totals.replied)} />
              <Stat label="Escalados" value={numberFormat.format(totals.escalated)} />
              <Stat label="Fallidos" value={numberFormat.format(totals.failed)} />
              <Stat label="Tokens de entrada" value={numberFormat.format(totals.inputTokens)} />
              <Stat label="Tokens de salida" value={numberFormat.format(totals.outputTokens)} />
              <Stat label="Minutos de audio" value={numberFormat.format(totals.audioMinutes)} />
              <Stat label="Costo estimado" value={usdFormat.format(totals.costUsd)} />
            </div>

            {summary.perDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin uso de IA en este periodo.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Día</TableHead>
                    <TableHead className="text-right">Turnos</TableHead>
                    <TableHead className="text-right">Escalados</TableHead>
                    <TableHead className="text-right">Fallidos</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Audio (min)</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.perDay.map((day) => (
                    <TableRow key={day.day}>
                      <TableCell>{day.day}</TableCell>
                      <TableCell className="text-right tabular-nums">{numberFormat.format(day.turns)}</TableCell>
                      <TableCell className="text-right tabular-nums">{numberFormat.format(day.escalated)}</TableCell>
                      <TableCell className="text-right tabular-nums">{numberFormat.format(day.failed)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {numberFormat.format(day.inputTokens + day.outputTokens)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{numberFormat.format(day.audioMinutes)}</TableCell>
                      <TableCell className="text-right tabular-nums">{usdFormat.format(day.costUsd)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
