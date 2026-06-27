'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarPlus } from 'lucide-react'
import type {
  NovedadEmployeeDetail,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { NovedadStatsCards } from '@/components/dashboard/novedades/novedad-stats-cards'
import { NovedadesTable } from '@/components/dashboard/novedades/novedades-table'
import { NovedadFormDialog } from '@/components/dashboard/novedades/novedad-form-dialog'

interface NovedadEmployeeDetailClientProps {
  detail: NovedadEmployeeDetail
  employees: NovedadUserRef[]
}

export function NovedadEmployeeDetailClient({
  detail,
  employees,
}: NovedadEmployeeDetailClientProps) {
  const router = useRouter()
  const { user, year, stats, novedades, availableYears } = detail

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<NovedadListItem | null>(null)

  const handleEdit = (novedad: NovedadListItem) => {
    setEditing(novedad)
    setEditOpen(true)
  }

  const handleEditOpenChange = (open: boolean) => {
    setEditOpen(open)
    if (!open) setEditing(null)
  }

  const handleYearChange = (value: string) => {
    router.push(`/dashboard/novedades/${user.id}?year=${value}`)
  }

  const refresh = () => router.refresh()

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/dashboard/novedades">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a novedades
          </Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {user.name || user.email}
            </h1>
            <p className="text-muted-foreground">{user.email} · año {year}</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(year)} onValueChange={handleYearChange}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
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
      </div>

      <NovedadStatsCards stats={stats} />

      <Card>
        <CardHeader>
          <CardTitle>Historial de novedades</CardTitle>
          <CardDescription>
            Vacaciones, permisos y calamidades registradas en {year}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NovedadesTable novedades={novedades} onEdit={handleEdit} hideEmployee />
        </CardContent>
      </Card>

      <NovedadFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        employees={employees}
        lockedUserId={user.id}
        onSaved={refresh}
      />

      <NovedadFormDialog
        open={editOpen}
        onOpenChange={handleEditOpenChange}
        employees={employees}
        editNovedad={editing}
        lockedUserId={user.id}
        onSaved={refresh}
      />
    </div>
  )
}
