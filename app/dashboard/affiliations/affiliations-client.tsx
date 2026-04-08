/**
 * Affiliations Client Component
 * Client-side logic for affiliations list page
 */

'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { AffiliationsTable } from '@/components/dashboard/affiliations/affiliations-table'
import {
  AffiliationTableFiltersBar,
  type AffiliationTableFilters,
} from '@/components/dashboard/affiliations/affiliations-table-filters'
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
  const [filters, setFilters] = useState<AffiliationTableFilters>({
    searchQuery: '',
    selectedProcessType: null,
    selectedSubProcessTypes: [],
    selectedStatus: null,
  })

  const filteredAffiliations = useMemo(() => {
    return affiliations.filter((aff) => {
      // Text search: process number, client name, identification number
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase()
        const matchesNumber = aff.affiliationNumber?.toLowerCase().includes(query)
        const matchesName = aff.client?.fullName?.toLowerCase().includes(query)
        const matchesId = aff.client?.identificationNumber?.toLowerCase().includes(query)
        if (!matchesNumber && !matchesName && !matchesId) return false
      }

      // Process type filter
      if (filters.selectedProcessType && aff.processType !== filters.selectedProcessType) {
        return false
      }

      // Sub-process type filter: affiliation must have at least one matching sub-process
      if (filters.selectedSubProcessTypes.length > 0) {
        const affSubTypes = (aff.subProcesses || []).map((sp) => sp.type)
        const hasMatch = filters.selectedSubProcessTypes.some((t) => affSubTypes.includes(t))
        if (!hasMatch) return false
      }

      // Status filter (ACTIVE / SENT / ARCHIVED)
      if (filters.selectedStatus && aff.status !== filters.selectedStatus) {
        return false
      }

      return true
    })
  }, [affiliations, filters])

  function handleAffiliationCreated() {
    // Dialog closes naturally when router.push navigates to detail page
    // No need to close it manually — the wizard shows a loading state during navigation
  }

  function handleAffiliationUpdated(
    affiliationId: string,
    updates: Partial<AffiliationWithRelations>
  ) {
    if (updates.isActive === false) {
      setAffiliations((prev) => prev.filter((aff) => aff.id !== affiliationId))
    } else {
      setAffiliations((prev) =>
        prev.map((aff) => (aff.id === affiliationId ? { ...aff, ...updates } : aff))
      )
    }
  }

  return (
    <>
      <div className="flex items-center justify-end">
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Proceso
        </Button>
      </div>

      <AffiliationTableFiltersBar
        filters={filters}
        onFiltersChange={setFilters}
      />

      <AffiliationsTable
        affiliations={filteredAffiliations}
        onAffiliationUpdated={handleAffiliationUpdated}
      />

      <AffiliationCreateWizard
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onAffiliationCreated={handleAffiliationCreated}
        currentUserId={currentUserId}
      />
    </>
  )
}
