'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { DisabilityWithRelations, DisabilityObservation } from '@/lib/types/disability.types'
import { getDisabilityById } from '@/lib/actions/disability.actions'
import { getSession } from '@/lib/actions/auth.actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { DisabilityObservationsSection } from '@/components/dashboard/disabilities/disability-observations-section'
import {
  ArrowLeft,
  Calendar,
  Building,
  User,
  FileText,
  CheckCircle,
  ExternalLink,
} from 'lucide-react'
import { DisabilityStatus, HealthAdministrator } from '@prisma/client'

const statusConfig = {
  [DisabilityStatus.NOT_STARTED]: {
    label: 'Por Iniciar',
    color: 'bg-gray-500',
  },
  [DisabilityStatus.IN_PROGRESS]: {
    label: 'En Proceso',
    color: 'bg-blue-500',
  },
  [DisabilityStatus.COMPLETED]: {
    label: 'Terminado',
    color: 'bg-green-500',
  },
  [DisabilityStatus.CLOSED]: {
    label: 'Cerrado',
    color: 'bg-gray-700',
  },
  [DisabilityStatus.URGENT]: {
    label: 'Urgente',
    color: 'bg-red-500',
  },
}

const administratorLabels = {
  [HealthAdministrator.EPS_SURA]: 'EPS SURA',
  [HealthAdministrator.PORVENIR]: 'PORVENIR',
  [HealthAdministrator.NUEVA_EPS]: 'NUEVA EPS',
  [HealthAdministrator.ARL_SURA]: 'ARL SURA',
  [HealthAdministrator.SALUD_TOTAL]: 'SALUD TOTAL',
  [HealthAdministrator.SAVIA_SALUD]: 'SAVIA SALUD',
}

export default function DisabilityDetailPage() {
  const params = useParams()
  const router = useRouter()
  const disabilityId = params.id as string

  const [disability, setDisability] = useState<DisabilityWithRelations | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | undefined>()
  const [currentUserRole, setCurrentUserRole] = useState<string | undefined>()

  useEffect(() => {
    async function loadData() {
      try {
        const [disabilityResult, session] = await Promise.all([
          getDisabilityById(disabilityId),
          getSession(),
        ])

        if (disabilityResult.success && disabilityResult.data) {
          setDisability(disabilityResult.data)
        } else {
          router.push('/dashboard/disabilities')
        }

        if (session?.user) {
          setCurrentUserId(session.user.id)
          setCurrentUserRole(session.user.role)
        }
      } catch (error) {
        console.error('Error loading data:', error)
        router.push('/dashboard/disabilities')
      } finally {
        setIsLoading(false)
      }
    }

    if (disabilityId) {
      loadData()
    }
  }, [disabilityId, router])

  const handleObservationAdded = (newObservation: DisabilityObservation) => {
    setDisability((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        observations: [newObservation, ...(prev.observations || [])],
      }
    })
  }

  const handleObservationDeleted = (observationId: string) => {
    setDisability((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        observations: (prev.observations || []).filter((o) => o.id !== observationId),
      }
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!disability) {
    return null
  }

  const statusInfo = statusConfig[disability.status]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Detalle de Incapacidad</h1>
          <p className="text-muted-foreground">
            Creado el {format(new Date(disability.createdAt), "d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>
        <div className="ml-auto">
          <Badge variant={disability.isActive ? 'default' : 'secondary'}>
            {disability.isActive ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>
      </div>

      {/* Main Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Información General</CardTitle>
            <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Fecha de Recepción */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Fecha de Recepción
              </div>
              <p className="text-lg">
                {format(new Date(disability.receptionDate), "d 'de' MMMM 'de' yyyy", { locale: es })}
              </p>
            </div>

            {/* Administradora */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Building className="h-4 w-4" />
                Administradora
              </div>
              <p className="text-lg">{administratorLabels[disability.administrator]}</p>
            </div>

            {/* Cliente */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Building className="h-4 w-4" />
                Cliente
              </div>
              <p className="text-lg">
                {disability.client?.fullName || 'N/A'}
              </p>
              {disability.client?.email && (
                <p className="text-sm text-muted-foreground">{disability.client.email}</p>
              )}
            </div>

            {/* Empleado */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <User className="h-4 w-4" />
                Empleado
              </div>
              <p className="text-lg">
                {disability.employee?.fullName || 'N/A'}
              </p>
              {disability.employee?.email && (
                <p className="text-sm text-muted-foreground">{disability.employee.email}</p>
              )}
            </div>

            {/* Fecha Inicio */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Fecha de Inicio
              </div>
              <p className="text-lg">
                {format(new Date(disability.startDate), "d 'de' MMMM 'de' yyyy", { locale: es })}
              </p>
            </div>

            {/* Fecha Fin */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Fecha de Finalización
              </div>
              <p className="text-lg">
                {format(new Date(disability.endDate), "d 'de' MMMM 'de' yyyy", { locale: es })}
              </p>
            </div>
          </div>

          <Separator />

          {/* Registro Banco */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              Registro Banco
            </div>
            <Badge variant={disability.bankRegistry ? 'default' : 'secondary'}>
              {disability.bankRegistry ? 'Sí' : 'No'}
            </Badge>
          </div>

          <Separator />

          {/* Transcripción */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4" />
              Transcripción
            </div>
            <p className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-md">
              {disability.transcription}
            </p>
          </div>

          {/* Radicación */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4" />
              Radicación
            </div>
            <p className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-md">
              {disability.filing}
            </p>
          </div>

          {/* Comprobante */}
          {disability.proofFileUrl && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileText className="h-4 w-4" />
                Comprobante
              </div>
              <Button variant="outline" asChild>
                <a
                  href={disability.proofFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Ver Comprobante
                </a>
              </Button>
            </div>
          )}

          <Separator />

          {/* Created By */}
          {disability.createdBy && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <User className="h-4 w-4" />
                Creado por
              </div>
              <p className="text-sm">
                {disability.createdBy.name || disability.createdBy.email}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Observations */}
      <DisabilityObservationsSection
        disabilityId={disability.id}
        observations={disability.observations || []}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onObservationAdded={handleObservationAdded}
        onObservationDeleted={handleObservationDeleted}
      />
    </div>
  )
}
