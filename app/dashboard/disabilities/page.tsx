'use client'

import { useEffect, useState } from 'react'
import type { SafeDisability } from '@/lib/types/disability.types'
import { getDisabilities, getDisabilitiesCount } from '@/lib/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DisabilitiesTable } from '@/components/dashboard/disabilities/disabilities-table'
import { DisabilitiesTableSkeleton } from '@/components/dashboard/disabilities/disabilities-table-skeleton'
import { DisabilityFormDialog } from '@/components/dashboard/disabilities/disability-form-dialog'
import { FilePlus, FileText, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { DisabilityStatus } from '@prisma/client'

export default function DisabilitiesPage() {
  const [disabilities, setDisabilities] = useState<SafeDisability[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingDisability, setEditingDisability] = useState<SafeDisability | null>(null)
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    byStatus: [] as { status: string; count: number }[],
  })

  useEffect(() => {
    async function loadData() {
      try {
        const [disabilitiesResult, statsResult] = await Promise.all([
          getDisabilities(),
          getDisabilitiesCount(),
        ])

        if (disabilitiesResult.success && disabilitiesResult.data) {
          setDisabilities(disabilitiesResult.data)
        }

        if (statsResult.success && statsResult.data) {
          setStats({
            total: statsResult.data.total,
            active: statsResult.data.active,
            inactive: statsResult.data.inactive,
            byStatus: statsResult.data.byStatus,
          })
        }
      } catch (error) {
        console.error('Error loading disabilities:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const handleDisabilityCreated = (newDisability: SafeDisability) => {
    setDisabilities((prev) => [newDisability, ...prev])
    setStats((prev) => ({
      ...prev,
      total: prev.total + 1,
      active: prev.active + 1,
    }))
  }

  const handleDisabilityUpdated = (disabilityId: string, updates: Partial<SafeDisability>) => {
    setDisabilities((prev) =>
      prev.map((d) => (d.id === disabilityId ? { ...d, ...updates } : d))
    )

    // Update stats if isActive changed
    if ('isActive' in updates) {
      setStats((prev) => ({
        ...prev,
        active: updates.isActive ? prev.active + 1 : prev.active - 1,
        inactive: updates.isActive ? prev.inactive - 1 : prev.inactive + 1,
      }))
    }
  }

  const handleEditDisability = (disability: SafeDisability) => {
    setEditingDisability(disability)
    setEditDialogOpen(true)
  }

  const handleEditDialogClose = (open: boolean) => {
    setEditDialogOpen(open)
    if (!open) {
      setEditingDisability(null)
    }
  }

  const getStatusCount = (status: DisabilityStatus) => {
    const found = stats.byStatus.find((s) => s.status === status)
    return found?.count || 0
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Incapacidades</h1>
          <p className="text-muted-foreground">
            Administra las incapacidades del sistema
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <FilePlus className="mr-2 h-4 w-4" />
          Crear Incapacidad
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Incapacidades
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active} activas, {stats.inactive} inactivas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              En Proceso
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getStatusCount(DisabilityStatus.IN_PROGRESS)}
            </div>
            <p className="text-xs text-muted-foreground">
              Incapacidades en proceso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Terminadas
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getStatusCount(DisabilityStatus.COMPLETED)}
            </div>
            <p className="text-xs text-muted-foreground">
              Incapacidades completadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Urgentes
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getStatusCount(DisabilityStatus.URGENT)}
            </div>
            <p className="text-xs text-muted-foreground">
              Requieren atención inmediata
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Incapacidades</CardTitle>
          <CardDescription>
            Lista completa de incapacidades registradas en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <DisabilitiesTableSkeleton />
          ) : (
            <DisabilitiesTable
              disabilities={disabilities}
              onDisabilityUpdated={handleDisabilityUpdated}
              onEditDisability={handleEditDisability}
            />
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <DisabilityFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onDisabilityCreated={handleDisabilityCreated}
      />

      <DisabilityFormDialog
        open={editDialogOpen}
        onOpenChange={handleEditDialogClose}
        onDisabilityUpdated={handleDisabilityUpdated}
        editDisability={editingDisability}
      />
    </div>
  )
}
