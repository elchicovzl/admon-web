/**
 * My Assignments Client Component
 * Client-side logic for my assignments page
 */

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ExternalLink, User, Loader2 } from 'lucide-react'
import { StatusBadge, TypeBadge } from '@/components/dashboard/affiliations/status-badge'
import type { AffiliationSubProcessWithRelations } from '@/lib/types/affiliation.types'
import { AffiliationSubProcessStatus } from '@prisma/client'

interface MyAssignmentsClientProps {
  initialAssignments: AffiliationSubProcessWithRelations[]
  currentUserId?: string
  currentUserRole?: string
}

export function MyAssignmentsClient({
  initialAssignments,
  currentUserId,
  currentUserRole,
}: MyAssignmentsClientProps) {
  const router = useRouter()
  const [isNavigating, startTransition] = useTransition()
  const [assignments] = useState<AffiliationSubProcessWithRelations[]>(initialAssignments)

  // Group assignments by status
  const groupedAssignments = {
    all: assignments,
    notStarted: assignments.filter(
      (a) => a.status === AffiliationSubProcessStatus.NOT_STARTED
    ),
    inProgress: assignments.filter(
      (a) => a.status === AffiliationSubProcessStatus.IN_PROGRESS
    ),
    inReview: assignments.filter(
      (a) => a.status === AffiliationSubProcessStatus.IN_REVIEW
    ),
    completed: assignments.filter(
      (a) => a.status === AffiliationSubProcessStatus.COMPLETED
    ),
    returned: assignments.filter(
      (a) => a.status === AffiliationSubProcessStatus.RETURNED
    ),
  }

  function AssignmentCard({ assignment }: { assignment: AffiliationSubProcessWithRelations }) {
    const affiliation = assignment.affiliation as any
    const client = affiliation?.client
    const affiliationNumber = affiliation?.affiliationNumber as string | undefined

    return (
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {affiliationNumber && (
                  <span className="font-mono text-sm text-primary">{affiliationNumber}</span>
                )}
                <TypeBadge type={assignment.type} className="text-xs" />
              </CardTitle>
              <CardDescription>
                {client?.fullName} · {client?.identificationType} {client?.identificationNumber}
              </CardDescription>
            </div>
            <StatusBadge status={assignment.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Email</p>
              <p className="font-medium truncate">{client?.email}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Teléfono</p>
              <p className="font-medium">{client?.phone}</p>
            </div>
          </div>

          {assignment.statusReason && (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-2">
              <p className="text-xs font-medium text-yellow-900">Nota:</p>
              <p className="text-xs text-yellow-700 mt-1">{assignment.statusReason}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              disabled={isNavigating}
              onClick={() => startTransition(() => router.push(`/dashboard/affiliations/${assignment.affiliationId}/subprocess/${assignment.id}`))}
            >
              {isNavigating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Ver Sub-proceso
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="relative">
      {isNavigating && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
          <div className="flex items-center gap-3 bg-card border shadow-lg rounded-lg px-6 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Cargando sub-proceso...</span>
          </div>
        </div>
      )}
      <CardHeader>
        <CardTitle>Tus Sub-procesos Asignados</CardTitle>
        <CardDescription>
          Organiza y gestiona tus asignaciones por estado
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-6">
            <TabsTrigger value="all">
              Todos ({groupedAssignments.all.length})
            </TabsTrigger>
            <TabsTrigger value="inProgress">
              En Proceso ({groupedAssignments.inProgress.length})
            </TabsTrigger>
            <TabsTrigger value="inReview">
              Revisión ({groupedAssignments.inReview.length})
            </TabsTrigger>
            <TabsTrigger value="notStarted" className="hidden lg:grid">
              Sin Iniciar ({groupedAssignments.notStarted.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="hidden lg:grid">
              Completados ({groupedAssignments.completed.length})
            </TabsTrigger>
            <TabsTrigger value="returned" className="hidden lg:grid">
              Devueltos ({groupedAssignments.returned.length})
            </TabsTrigger>
          </TabsList>

          {Object.entries(groupedAssignments).map(([key, items]) => (
            <TabsContent key={key} value={key} className="mt-6">
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No hay sub-procesos en esta categoría</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((assignment) => (
                    <AssignmentCard key={assignment.id} assignment={assignment} />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}
