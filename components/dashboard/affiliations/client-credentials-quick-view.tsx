/**
 * Client Credentials Quick View Component
 * Modal to quickly view client credentials for admin portals
 */

'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Copy, ExternalLink, Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getClientCredentials } from '@/lib/actions/credential.actions'
import type { ClientCredentialWithRelations } from '@/lib/types/client.types'

interface ClientCredentialsQuickViewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  clientName: string
}

export function ClientCredentialsQuickView({
  open,
  onOpenChange,
  clientId,
  clientName,
}: ClientCredentialsQuickViewProps) {
  const [credentials, setCredentials] = useState<ClientCredentialWithRelations[]>([])
  const [loading, setLoading] = useState(false)
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (open) {
      loadCredentials()
    }
  }, [open, clientId])

  async function loadCredentials() {
    setLoading(true)
    try {
      const result = await getClientCredentials(clientId)
      if (result.success && result.data) {
        setCredentials(result.data)
      } else {
        toast.error(result.error || 'Error al cargar las credenciales')
      }
    } catch (error) {
      console.error('Error loading credentials:', error)
      toast.error('Error al cargar las credenciales')
    } finally {
      setLoading(false)
    }
  }

  function togglePasswordVisibility(credentialId: string) {
    setVisiblePasswords((prev) => ({
      ...prev,
      [credentialId]: !prev[credentialId],
    }))
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copiado al portapapeles`)
    } catch (error) {
      toast.error('Error al copiar al portapapeles')
    }
  }

  const administratorTypeLabels: Record<string, string> = {
    EPS: 'EPS',
    AFP: 'AFP',
    ARL: 'ARL',
    CCF: 'CCF',
    PILA_OPERATOR: 'Operador PILA',
    OTRA: 'Otra',
  }

  const administratorTypeColors: Record<string, string> = {
    EPS: 'bg-blue-100 text-blue-700 border-blue-300',
    AFP: 'bg-green-100 text-green-700 border-green-300',
    ARL: 'bg-orange-100 text-orange-700 border-orange-300',
    CCF: 'bg-purple-100 text-purple-700 border-purple-300',
    PILA_OPERATOR: 'bg-gray-100 text-gray-700 border-gray-300',
    OTRA: 'bg-gray-100 text-gray-700 border-gray-300',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Claves de Administradoras</DialogTitle>
          <DialogDescription>
            Credenciales para portales de administradoras de {clientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : credentials.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No hay credenciales registradas para este cliente</p>
            </div>
          ) : (
            credentials.map((credential) => (
              <Card key={credential.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{credential.administratorName}</CardTitle>
                    <Badge
                      variant="outline"
                      className={administratorTypeColors[credential.administratorType]}
                    >
                      {administratorTypeLabels[credential.administratorType]}
                    </Badge>
                  </div>
                  {credential.portalUrl && (
                    <CardDescription className="flex items-center gap-1">
                      <a
                        href={credential.portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {credential.portalUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Username */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-muted-foreground">Usuario</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono">
                        {credential.username}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(credential.username, 'Usuario')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-muted-foreground">Contraseña</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono">
                        {visiblePasswords[credential.id]
                          ? credential.password || '••••••••'
                          : '••••••••'}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => togglePasswordVisibility(credential.id)}
                      >
                        {visiblePasswords[credential.id] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          copyToClipboard(credential.password || '', 'Contraseña')
                        }
                        disabled={!credential.password}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Notes */}
                  {credential.notes && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-muted-foreground">Notas</label>
                      <p className="text-sm px-3 py-2 bg-muted/50 rounded-md">
                        {credential.notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
