/**
 * Affiliations Client Component
 * Client-side logic for affiliations list page
 */

'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { AffiliationsTable } from '@/components/dashboard/affiliations/affiliations-table'
import type { AffiliationWithRelations, AffiliationStats } from '@/lib/types/affiliation.types'

const AffiliationCreateWizard = dynamic(
  () => import('@/components/dashboard/affiliations/affiliation-create-wizard')
    .then(mod => ({ default: mod.AffiliationCreateWizard })),
  { ssr: false }
)

interface AffiliationsClientProps {
  initialAffiliations: AffiliationWithRelations[]
  currentUserId?: string
}

export function AffiliationsClient({
  initialAffiliations,
  currentUserId,
}: AffiliationsClientProps) {
  const [affiliations, setAffiliations] = useState<AffiliationWithRelations[]>(initialAffiliations)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  function handleAffiliationCreated() {
    // Dialog closes naturally when router.push navigates to detail page
    // No need to close it manually — the wizard shows a loading state during navigation
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
              <CardTitle>Listado de Procesos</CardTitle>
              <CardDescription>
                Todas las afiliaciones registradas en el sistema
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Proceso
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
