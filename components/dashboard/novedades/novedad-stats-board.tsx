'use client'

import Link from 'next/link'
import { Users } from 'lucide-react'
import type { EmployeeVacationStats } from '@/lib/types/novedad.types'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface NovedadStatsBoardProps {
  stats: EmployeeVacationStats[]
}

function balanceColor(available: number, annual: number): string {
  const ratio = annual > 0 ? available / annual : 0
  if (ratio <= 0) return 'text-destructive'
  if (ratio <= 0.34) return 'text-amber-600 dark:text-amber-500'
  return 'text-emerald-600 dark:text-emerald-500'
}

export function NovedadStatsBoard({ stats }: NovedadStatsBoardProps) {
  if (stats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <Users className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="font-medium">No hay empleados activos</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead className="text-center">Disponibles</TableHead>
            <TableHead className="text-center">Usados</TableHead>
            <TableHead className="text-center">Vacaciones</TableHead>
            <TableHead className="text-center">Permisos</TableHead>
            <TableHead className="text-center">Calamidades</TableHead>
            <TableHead className="w-20 text-right">Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.map((s) => (
            <TableRow key={s.userId}>
              <TableCell className="font-medium">
                <Link href={`/dashboard/novedades/${s.userId}`} className="hover:underline">
                  {s.name || s.email}
                </Link>
              </TableCell>
              <TableCell className="text-center">
                <span className={cn('font-semibold', balanceColor(s.availableDays, s.annualDays))}>
                  {s.availableDays}
                </span>
                <span className="text-muted-foreground"> / {s.annualDays}</span>
              </TableCell>
              <TableCell className="text-center">{s.usedDays}</TableCell>
              <TableCell className="text-center">{s.vacacionesCount}</TableCell>
              <TableCell className="text-center">
                {s.permisosCount}
                {s.permisosHours > 0 && (
                  <span className="text-muted-foreground"> ({s.permisosHours}h)</span>
                )}
              </TableCell>
              <TableCell className="text-center">{s.calamidadCount}</TableCell>
              <TableCell className="text-right">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/novedades/${s.userId}`}>Ver</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
