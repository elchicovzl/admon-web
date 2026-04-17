'use client'

import { useEffect, useState, useTransition } from 'react'
import { Check, Loader2, Save, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  getClientBeneficiaries,
  updateSubProcessBeneficiaries,
} from '@/lib/actions/affiliation.actions'
import type { AffiliationProcessType } from '@prisma/client'

interface Props {
  subProcessId: string
  // The client whose beneficiaries to show (employee if EMPRESA, client otherwise)
  ownerClientId: string
  processType: AffiliationProcessType
  initialBeneficiaryIds: string[]
  // Whether sub-process is already completed — if so, readonly
  readonly?: boolean
}

interface Beneficiary {
  id: string
  tipoRelacion: string
  nombreCompleto: string
  identificationType: string
  identificationNumber: string
  isExcluded: boolean
}

export function SubProcessBeneficiariesSection({
  subProcessId,
  ownerClientId,
  processType,
  initialBeneficiaryIds,
  readonly = false,
}: Props) {
  const isExclusion = processType === 'EXCLUSION_BENEFICIARIOS'
  const actionLabel = isExclusion ? 'excluir' : 'incluir'

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>(initialBeneficiaryIds)
  const [initialIds, setInitialIds] = useState<string[]>(initialBeneficiaryIds)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const result = await getClientBeneficiaries(ownerClientId)
      if (cancelled) return
      setBeneficiaries(result.success && result.data ? result.data : [])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [ownerClientId])

  const dirty =
    selectedIds.length !== initialIds.length ||
    selectedIds.some((id) => !initialIds.includes(id))

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateSubProcessBeneficiaries({
        subProcessId,
        beneficiaryIds: selectedIds,
      })
      if (result.success) {
        toast.success('Beneficiarios actualizados')
        setInitialIds(selectedIds)
      } else {
        toast.error(result.error || 'Error al guardar')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-4 w-4" />
          Beneficiarios a {actionLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando beneficiarios...
          </div>
        ) : beneficiaries.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Este cliente no tiene beneficiarios registrados.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {selectedIds.length} de {beneficiaries.length} seleccionados
              </span>
              {!readonly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto py-1 px-2 text-xs"
                  onClick={() =>
                    setSelectedIds(
                      selectedIds.length === beneficiaries.length
                        ? []
                        : beneficiaries.map((b) => b.id)
                    )
                  }
                >
                  {selectedIds.length === beneficiaries.length
                    ? 'Deseleccionar todos'
                    : 'Seleccionar todos'}
                </Button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto rounded-md border bg-muted/10 p-2 space-y-1">
              {beneficiaries.map((b) => {
                const checked = selectedIds.includes(b.id)
                return (
                  <div
                    key={b.id}
                    className={cn(
                      'flex items-center gap-2 rounded-sm px-2 py-1.5',
                      !readonly && 'cursor-pointer hover:bg-muted/50',
                      checked && 'bg-muted/30'
                    )}
                    onClick={() => !readonly && toggle(b.id)}
                  >
                    <div
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                        checked ? 'bg-primary border-primary' : 'border-input'
                      )}
                    >
                      {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {b.nombreCompleto}{' '}
                        <span className="text-xs text-muted-foreground">({b.tipoRelacion})</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {b.identificationType} {b.identificationNumber}
                        {b.isExcluded && (
                          <Badge
                            variant="outline"
                            className="ml-2 text-[10px] border-red-300 text-red-700"
                          >
                            Ya excluido
                          </Badge>
                        )}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              Los beneficiarios se marcarán como {isExclusion ? 'excluidos' : 'incluidos'} al
              completar el sub-proceso.
            </p>

            {!readonly && dirty && (
              <Button onClick={handleSave} disabled={isPending} size="sm" className="w-full">
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Guardar selección
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
