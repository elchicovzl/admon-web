'use client'

import { useState } from 'react'
import { AdministratorType } from '@prisma/client'
import type { SafeClientCredential } from '@/lib/types/client.types'
import { revealCredentialPassword } from '@/lib/actions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  User,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Edit,
  Trash2,
  Loader2,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface CredentialCardProps {
  credential: SafeClientCredential
  onEdit: (credential: SafeClientCredential) => void
  onDelete: (credentialId: string) => void
}

export function CredentialCard({ credential, onEdit, onDelete }: CredentialCardProps) {
  const [isRevealing, setIsRevealing] = useState(false)
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [copiedField, setCopiedField] = useState<'username' | 'password' | null>(null)

  const getAdministratorTypeLabel = (type: AdministratorType) => {
    const labels = {
      EPS: 'EPS',
      AFP: 'AFP',
      ARL: 'ARL',
      CCF: 'CCF',
      PILA_OPERATOR: 'PILA',
      OTRA: 'Otra',
    }
    return labels[type]
  }

  const getAdministratorTypeBadgeVariant = (type: AdministratorType) => {
    const variants = {
      EPS: 'default',
      AFP: 'secondary',
      ARL: 'outline',
      CCF: 'secondary',
      PILA_OPERATOR: 'default',
      OTRA: 'outline',
    }
    return variants[type] as 'default' | 'secondary' | 'outline'
  }

  const handleRevealPassword = async () => {
    if (revealedPassword) {
      // If password is already revealed, just toggle visibility
      setShowPassword(!showPassword)
      return
    }

    setIsRevealing(true)

    try {
      const result = await revealCredentialPassword(credential.id)

      if (result.success && result.data) {
        setRevealedPassword(result.data.password)
        setShowPassword(true)
        toast.success('Contraseña revelada')

        // Auto-hide password after 30 seconds for security
        setTimeout(() => {
          setShowPassword(false)
        }, 30000)
      } else {
        toast.error(result.error || 'Error al revelar contraseña')
      }
    } catch (error) {
      console.error('Reveal password error:', error)
      toast.error('Error inesperado al revelar contraseña')
    } finally {
      setIsRevealing(false)
    }
  }

  const handleCopy = async (text: string, field: 'username' | 'password') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast.success(`${field === 'username' ? 'Usuario' : 'Contraseña'} copiado al portapapeles`)

      setTimeout(() => {
        setCopiedField(null)
      }, 2000)
    } catch (error) {
      console.error('Copy error:', error)
      toast.error('Error al copiar')
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{credential.administratorName}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={getAdministratorTypeBadgeVariant(credential.administratorType)}>
                    {getAdministratorTypeLabel(credential.administratorType)}
                  </Badge>
                  {credential.createdBy && (
                    <span className="text-xs text-muted-foreground">
                      por {credential.createdBy.name || credential.createdBy.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => onEdit(credential)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(credential.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Username */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Usuario:</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted font-mono text-sm">
              <span className="flex-1">{credential.username}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => handleCopy(credential.username, 'username')}
              >
                {copiedField === 'username' ? (
                  <Check className="h-3 w-3 text-green-600" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Contraseña:</span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={handleRevealPassword}
                  disabled={isRevealing}
                >
                  {isRevealing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : showPassword ? (
                    <EyeOff className="h-3 w-3" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                  <span className="ml-1">{showPassword ? 'Ocultar' : 'Ver'}</span>
                </Button>
                {revealedPassword && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => handleCopy(revealedPassword, 'password')}
                  >
                    {copiedField === 'password' ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
            </div>
            <div className="p-2 rounded-md bg-muted font-mono text-sm">
              {showPassword && revealedPassword ? revealedPassword : '••••••••••••'}
            </div>
          </div>

          {/* Portal URL */}
          {credential.portalUrl && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                asChild
              >
                <a
                  href={credential.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-3 w-3" />
                  Abrir Portal
                </a>
              </Button>
            </div>
          )}

          {/* Notes */}
          {credential.notes && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                {credential.notes}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="pt-2 border-t text-xs text-muted-foreground">
            Creado {format(new Date(credential.createdAt), "d 'de' MMMM, yyyy", { locale: es })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
