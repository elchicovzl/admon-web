/**
 * Disabilities Client Component
 * Client-side logic for disabilities list page
 */

'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { SafeDisability } from '@/lib/types/disability.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FilePlus } from 'lucide-react'
import { DisabilitiesTable } from '@/components/dashboard/disabilities/disabilities-table'

const DisabilityFormDialog = dynamic(
  () => import('@/components/dashboard/disabilities/disability-form-dialog')
    .then(mod => ({ default: mod.DisabilityFormDialog })),
  { ssr: false }
)

interface DisabilitiesClientProps {
  initialDisabilities: SafeDisability[]
}

export function DisabilitiesClient({ initialDisabilities }: DisabilitiesClientProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingDisability, setEditingDisability] = useState<SafeDisability | null>(null)

  function handleDisabilityCreated() {
    // Server Action already calls revalidatePath
    setCreateDialogOpen(false)
  }

  function handleDisabilityUpdated() {
    // Server Action already calls revalidatePath
    setEditDialogOpen(false)
    setEditingDisability(null)
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

  return (
    <>
      <div className="flex items-center justify-between mb-6">
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

      <Card>
        <CardHeader>
          <CardTitle>Incapacidades</CardTitle>
          <CardDescription>
            Lista completa de incapacidades registradas en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DisabilitiesTable
            disabilities={initialDisabilities}
            onEditDisability={handleEditDisability}
          />
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
    </>
  )
}
