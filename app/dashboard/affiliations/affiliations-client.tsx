/**
 * Affiliations Client Component
 * Client-side logic for affiliations list page
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { AffiliationsTable } from '@/components/dashboard/affiliations/affiliations-table'
import { AffiliationCreateWizard } from '@/components/dashboard/affiliations/affiliation-create-wizard'
import type { AffiliationWithRelations, AffiliationStats } from '@/lib/types/affiliation.types'

interface AffiliationsClientProps {
  initialAffiliations: AffiliationWithRelations[]
  initialStats?: AffiliationStats
  currentUserId?: string
}

export function AffiliationsClient({
  initialAffiliations,
  initialStats,
  currentUserId,
}: AffiliationsClientProps) {
  const [affiliations, setAffiliations] = useState<AffiliationWithRelations[]>(initialAffiliations)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  function handleAffiliationCreated() {
    // Refresh the page to get updated data
    window.location.reload()
  }

  function handleAffiliationUpdated(
    affiliationId: string,
    updates: Partial<AffiliationWithRelations>
  ) {
    setAffiliations((prev) =>
      prev.map((aff) => (aff.id === affiliationId ? { ...aff, ...updates } : aff))
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Listado de Afiliaciones</CardTitle>
              <CardDescription>
                Todas las afiliaciones registradas en el sistema
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Afiliación
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <AffiliationsTable
            affiliations={affiliations}
            onAffiliationUpdated={handleAffiliationUpdated}
          />
        </CardContent>
      </Card>

      <AffiliationCreateWizard
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onAffiliationCreated={handleAffiliationCreated}
        currentUserId={currentUserId}
      />
    </>
  )
}
