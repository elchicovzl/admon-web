'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useParams } from 'next/navigation'
import { getClientById } from '@/lib/actions/client.actions'
import type { ClientWithRelations } from '@/lib/types/client.types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Building2 } from 'lucide-react'
import { ClientNotesSection } from '@/components/dashboard/clients/client-notes-section'
import { ClientDocumentsGallerySkeleton } from '@/components/dashboard/clients/client-documents-gallery-skeleton'
import { ClientCredentialsSection } from '@/components/dashboard/clients/client-credentials-section'
import { CompanyEmployeesSection } from '@/components/dashboard/clients/company-employees-section'
import { ClientBeneficiariesSection } from '@/components/dashboard/clients/client-beneficiaries-section'
import { ClientInfoPanel } from '@/components/dashboard/clients/client-info-panel'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ClientType } from '@prisma/client'
import Link from 'next/link'

const ClientDocumentsGallery = dynamic(
  () => import('@/components/dashboard/clients/client-documents-gallery')
    .then(mod => ({ default: mod.ClientDocumentsGallery })),
  {
    loading: () => <ClientDocumentsGallerySkeleton />,
    ssr: false, // FilePond requires browser APIs
  }
)

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
            onClick={() => router.push(
              client.company ? `/dashboard/clients/${client.company.id}` : '/dashboard/clients'
            )}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{client.fullName}</h1>
            <div className="flex items-center gap-3">
              <p className="text-muted-foreground">
                Cliente desde{' '}
                {format(new Date(client.createdAt), "d 'de' MMMM, yyyy", { locale: es })}
              </p>
              {client.company && (
                <Link
                  href={`/dashboard/clients/${client.company.id}`}
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  {client.company.fullName}
                </Link>
              )}
            </div>
          </div>
        </div>
        <Badge variant={client.isActive ? 'default' : 'destructive'}>
          {client.isActive ? 'Activo' : 'Inactivo'}
        </Badge>
      </div>

      {/* Unified Info Panel */}
      <ClientInfoPanel client={client} onClientUpdated={setClient} />

      {/* Beneficiaries Section (not for companies) */}
      {client.clientType !== ClientType.EMPRESA && (
        <ClientBeneficiariesSection
          clientId={client.id}
          initialBeneficiaries={client.beneficiaries || []}
        />
      )}

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
