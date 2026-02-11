/**
 * My Assignments Client Component
 * Client-side logic for my assignments page
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ExternalLink, User } from 'lucide-react'
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
    const client = (assignment.affiliation as any)?.client

    return (
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {client?.fullName}
                <TypeBadge type={assignment.type} className="text-xs" />
              </CardTitle>
              <CardDescription>
                {client?.identificationType} {client?.identificationNumber}
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
            <Button variant="default" size="sm" asChild className="flex-1">
              <Link href={`/dashboard/affiliations/${assignment.affiliationId}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver Afiliación
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
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
