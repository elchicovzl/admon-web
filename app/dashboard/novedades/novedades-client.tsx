'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus } from 'lucide-react'
import type {
  EmployeeVacationStats,
  NovedadListItem,
  NovedadUserRef,
} from '@/lib/types/novedad.types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { NovedadStatsBoard } from '@/components/dashboard/novedades/novedad-stats-board'
import { NovedadesTable } from '@/components/dashboard/novedades/novedades-table'
import { NovedadFormDialog } from '@/components/dashboard/novedades/novedad-form-dialog'

interface NovedadesClientProps {
  year: number
  stats: EmployeeVacationStats[]
  novedades: NovedadListItem[]
  employees: NovedadUserRef[]
}

export function NovedadesClient({
  year,
  stats,
  novedades,
  employees,
}: NovedadesClientProps) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<NovedadListItem | null>(null)

  const now = new Date().getUTCFullYear()
  const years = Array.from({ length: 4 }, (_, i) => now - i)
  if (!years.includes(year)) years.push(year)
  years.sort((a, b) => b - a)

  const handleEdit = (novedad: NovedadListItem) => {
    setEditing(novedad)
    setEditOpen(true)
  }

  const handleEditOpenChange = (open: boolean) => {
    setEditOpen(open)
    if (!open) setEditing(null)
  }

  const handleYearChange = (value: string) => {
    router.push(`/dashboard/novedades?year=${value}`)
  }

  const refresh = () => router.refresh()

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Novedades</h1>
          <p className="text-muted-foreground">
            Vacaciones, permisos y calamidades · año {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={handleYearChange}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateOpen(true)}>
            <CalendarPlus className="mr-2 h-4 w-4" />
            Registrar novedad
          </Button>
        </div>
      </div>

      <Tabs defaultValue="tablero" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tablero">Tablero</TabsTrigger>
          <TabsTrigger value="registros">Registros</TabsTrigger>
        </TabsList>

        <TabsContent value="tablero">
          <Card>
            <CardHeader>
              <CardTitle>Tablero por empleado</CardTitle>
              <CardDescription>
                Saldo de vacaciones (15 días hábiles) y novedades de cada empleado en {year}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NovedadStatsBoard stats={stats} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="registros">
          <Card>
            <CardHeader>
              <CardTitle>Registros</CardTitle>
              <CardDescription>
                Todas las novedades registradas en {year}. Editá o eliminá las que se
                cargaron mal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NovedadesTable novedades={novedades} onEdit={handleEdit} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <NovedadFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        employees={employees}
        onSaved={refresh}
      />

      <NovedadFormDialog
        open={editOpen}
        onOpenChange={handleEditOpenChange}
        employees={employees}
        editNovedad={editing}
        onSaved={refresh}
      />
    </>
  )
}
