'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getClientById } from '@/lib/actions'
import type { ClientWithRelations } from '@/lib/types/client.types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Mail, Phone, FileText, Calendar, User, CreditCard } from 'lucide-react'
import { ClientNotesSection } from '@/components/dashboard/clients/client-notes-section'
import { ClientDocumentsGallery } from '@/components/dashboard/clients/client-documents-gallery'
import { ClientCredentialsSection } from '@/components/dashboard/clients/client-credentials-section'
import { CompanyEmployeesSection } from '@/components/dashboard/clients/company-employees-section'
import { ClientAddressSection } from '@/components/dashboard/clients/client-address-section'
import { ClientAdditionalInfoSection } from '@/components/dashboard/clients/client-additional-info-section'
import { ClientBeneficiariesSection } from '@/components/dashboard/clients/client-beneficiaries-section'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ClientType, IdentificationType } from '@prisma/client'
import Link from 'next/link'

export default function ClientDetailPage() {
  const router = useRouter()
  const params = useParams()
  const clientId = params.id as string

  const [client, setClient] = useState<ClientWithRelations | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadClient() {
      try {
        const result = await getClientById(clientId)

        if (result.success && result.data) {
          setClient(result.data)
        } else {
          console.error('Error loading client:', result.error)
        }
      } catch (error) {
        console.error('Error loading client:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (clientId) {
      loadClient()
    }
  }, [clientId])

  const getIdentificationTypeLabel = (type: IdentificationType) => {
    const labels = {
      CEDULA: 'Cédula',
      CEDULA_EXTRANJERIA: 'Cédula Extranjería',
      PPT: 'PPT',
      NIT: 'NIT',
    }
    return labels[type]
  }

  const getClientTypeLabel = (type: ClientType) => {
    const labels = {
      EMPLEADO: 'Empleado',
      EMPRESA: 'Empresa',
      INDEPENDIENTE: 'Independiente',
    }
    return labels[type]
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[200px]" />
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">Cliente no encontrado</p>
        <Button onClick={() => router.push('/dashboard/clients')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a Clientes
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/clients')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{client.fullName}</h1>
            <p className="text-muted-foreground">
              Cliente desde{' '}
              {format(new Date(client.createdAt), "d 'de' MMMM, yyyy", { locale: es })}
            </p>
          </div>
        </div>
        <Badge variant={client.isActive ? 'default' : 'destructive'}>
          {client.isActive ? 'Activo' : 'Inactivo'}
        </Badge>
      </div>

      {/* Client Information Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>Información Personal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Nombre Completo</p>
                <p className="text-sm text-muted-foreground">{client.fullName}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Identificación</p>
                <p className="text-sm text-muted-foreground">
                  {getIdentificationTypeLabel(client.identificationType)}:{' '}
                  {client.identificationNumber}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Tipo de Cliente</p>
                <p className="text-sm text-muted-foreground">
                  {getClientTypeLabel(client.clientType)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Status</p>
                <p className="text-sm text-muted-foreground">{client.status}</p>
              </div>
            </div>

            {/* Company info for employees */}
            {client.clientType === ClientType.EMPLEADO && client.company && (
              <div className="flex items-start gap-3 pt-2 border-t">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Empresa</p>
                  <Link
                    href={`/dashboard/clients/${client.company.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {client.company.fullName}
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Información de Contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Email</p>
                <a
                  href={`mailto:${client.email}`}
                  className="text-sm text-muted-foreground hover:text-primary underline"
                >
                  {client.email}
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Teléfono</p>
                <a
                  href={`tel:${client.phone}`}
                  className="text-sm text-muted-foreground hover:text-primary underline"
                >
                  {client.phone}
                </a>
              </div>
            </div>

            {client.createdBy && (
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Creado por</p>
                  <p className="text-sm text-muted-foreground">
                    {client.createdBy.name || client.createdBy.email}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Address Section */}
      <ClientAddressSection clientId={client.id} initialAddress={client.address} />

      {/* Additional Info Section */}
      <ClientAdditionalInfoSection
        clientId={client.id}
        initialInfo={client.additionalInfo}
      />

      {/* Beneficiaries Section */}
      <ClientBeneficiariesSection
        clientId={client.id}
        initialBeneficiaries={client.beneficiaries || []}
      />

      {/* Employees Section (only for companies) */}
      {client.clientType === ClientType.EMPRESA && (
        <CompanyEmployeesSection
          companyId={client.id}
          initialEmployees={client.employees || []}
        />
      )}

      {/* Credentials Section */}
      <ClientCredentialsSection
        clientId={client.id}
        initialCredentials={client.credentials || []}
      />

      {/* Notes Section */}
      <ClientNotesSection clientId={client.id} initialNotes={client.notes || []} />

      {/* Documents Gallery */}
      <ClientDocumentsGallery
        clientId={client.id}
        initialDocuments={client.documents || []}
      />
    </div>
  )
}
