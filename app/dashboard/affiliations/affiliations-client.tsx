/**
 * Affiliations Client Component
 * Client-side logic for affiliations list page
 */

'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, FileText, ArrowRightLeft, HeartPulse, Landmark } from 'lucide-react'
import { AffiliationsTable } from '@/components/dashboard/affiliations/affiliations-table'
import {
  AffiliationTableFiltersBar,
  type AffiliationTableFilters,
} from '@/components/dashboard/affiliations/affiliations-table-filters'
import type { AffiliationWithRelations } from '@/lib/types/affiliation.types'
import { AffiliationProcessType } from '@prisma/client'

const AffiliationCreateWizard = dynamic(
  () => import('@/components/dashboard/affiliations/affiliation-create-wizard')
    .then(mod => ({ default: mod.AffiliationCreateWizard })),
  { ssr: false }
)

// Process types that belong to each category card
const AFILIACIONES_TYPES = [
  AffiliationProcessType.DEPENDIENTE,
  AffiliationProcessType.INDEPENDIENTE,
  AffiliationProcessType.TRABAJADOR_TIEMPO_PARCIAL,
  AffiliationProcessType.INDEPENDIENTE_VOLUNTARIO,
  AffiliationProcessType.CONTRATISTA_INDEPENDIENTE,
  AffiliationProcessType.BENEFICIARIO_UPC_ADICIONAL,
  AffiliationProcessType.COTIZANTE_INDEPENDIENTE_SALUD,
  AffiliationProcessType.COTIZANTE_PENSIONES_PAGO_TERCERO,
  AffiliationProcessType.PLANILLA_S_SERVICIO_DOMESTICO,
  AffiliationProcessType.PLANILLA_E_EMPLEADOS,
  AffiliationProcessType.LIQUIDACIONES,
  AffiliationProcessType.LIQUIDACION_PLANILLA_S,
  AffiliationProcessType.INCLUSION_BENEFICIARIOS,
  AffiliationProcessType.EXCLUSION_BENEFICIARIOS,
  AffiliationProcessType.OTRO,
]

type CategoryFilter = 'all' | 'afiliaciones' | 'traslados' | 'incapacidades' | 'pensiones'

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
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [filters, setFilters] = useState<AffiliationTableFilters>({
    searchQuery: '',
    selectedProcessType: null,
    selectedSubProcessTypes: [],
    selectedStatus: null,
  })

  // Count per category
  const counts = useMemo(() => ({
    afiliaciones: affiliations.filter(a => a.processType && AFILIACIONES_TYPES.includes(a.processType)).length,
    traslados: affiliations.filter(a => a.processType === AffiliationProcessType.TRASLADO_EPS).length,
    incapacidades: affiliations.filter(a => a.processType === AffiliationProcessType.COBRO_INCAPACIDADES).length,
    pensiones: affiliations.filter(a => a.processType === AffiliationProcessType.ASESORIAS_PENSIONES).length,
  }), [affiliations])

  // Apply category filter first, then table filters
  const filteredAffiliations = useMemo(() => {
    let result = affiliations

    // Category card filter
    if (categoryFilter === 'afiliaciones') {
      result = result.filter(a => a.processType && AFILIACIONES_TYPES.includes(a.processType))
    } else if (categoryFilter === 'traslados') {
      result = result.filter(a => a.processType === AffiliationProcessType.TRASLADO_EPS)
    } else if (categoryFilter === 'incapacidades') {
      result = result.filter(a => a.processType === AffiliationProcessType.COBRO_INCAPACIDADES)
    } else if (categoryFilter === 'pensiones') {
      result = result.filter(a => a.processType === AffiliationProcessType.ASESORIAS_PENSIONES)
    }

    // Table filters
    return result.filter((aff) => {
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase()
        const matchesNumber = aff.affiliationNumber?.toLowerCase().includes(query)
        const matchesName = aff.client?.fullName?.toLowerCase().includes(query)
        const matchesId = aff.client?.identificationNumber?.toLowerCase().includes(query)
        if (!matchesNumber && !matchesName && !matchesId) return false
      }

      if (filters.selectedProcessType && aff.processType !== filters.selectedProcessType) {
        return false
      }

      if (filters.selectedSubProcessTypes.length > 0) {
        const affSubTypes = (aff.subProcesses || []).map((sp) => sp.type)
        const hasMatch = filters.selectedSubProcessTypes.some((t) => affSubTypes.includes(t))
        if (!hasMatch) return false
      }

      if (filters.selectedStatus && aff.status !== filters.selectedStatus) {
        return false
      }

      return true
    })
  }, [affiliations, categoryFilter, filters])

  function handleAffiliationCreated() {
    // Dialog closes naturally when router.push navigates to detail page
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

  function handleCategoryClick(category: CategoryFilter) {
    setCategoryFilter(prev => prev === category ? 'all' : category)
  }

  const cards: { key: CategoryFilter; label: string; count: number; icon: React.ReactNode }[] = [
    { key: 'afiliaciones', label: 'Afiliaciones', count: counts.afiliaciones, icon: <FileText className="h-4 w-4" /> },
    { key: 'traslados', label: 'Traslados EPS', count: counts.traslados, icon: <ArrowRightLeft className="h-4 w-4" /> },
    { key: 'incapacidades', label: 'Incapacidades', count: counts.incapacidades, icon: <HeartPulse className="h-4 w-4" /> },
    { key: 'pensiones', label: 'Procesos de Pensión', count: counts.pensiones, icon: <Landmark className="h-4 w-4" /> },
  ]

  return (
    <>
      {/* Category filter cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ key, label, count, icon }) => (
          <Card
            key={key}
            className={`cursor-pointer transition-colors ${
              categoryFilter === key
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                : 'hover:border-muted-foreground/30'
            }`}
            onClick={() => handleCategoryClick(key)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-medium ${categoryFilter === key ? 'text-blue-700 dark:text-blue-400' : ''}`}>
                {label}
              </CardTitle>
              <span className={categoryFilter === key ? 'text-blue-500' : 'text-muted-foreground'}>
                {icon}
              </span>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${categoryFilter === key ? 'text-blue-700 dark:text-blue-400' : ''}`}>
                {count}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
