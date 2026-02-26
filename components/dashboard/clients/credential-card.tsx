'use client'

import { useState } from 'react'
import { AdministratorType } from '@prisma/client'
import type { SafeClientCredential } from '@/lib/types/client.types'
import { revealCredentialPassword } from '@/lib/actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
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

interface CredentialCardProps {
  credential: SafeClientCredential
  onEdit: (credential: SafeClientCredential) => void
  onDelete: (credentialId: string) => void
}

const TYPE_LABELS: Record<AdministratorType, string> = {
  EPS: 'EPS',
  AFP: 'AFP',
  ARL: 'ARL',
  CCF: 'CCF',
  PILA_OPERATOR: 'PILA',
  OTRA: 'Otra',
}

const TYPE_BADGE_VARIANT: Record<AdministratorType, 'default' | 'secondary' | 'outline'> = {
  EPS: 'default',
  AFP: 'secondary',
  ARL: 'outline',
  CCF: 'secondary',
  PILA_OPERATOR: 'default',
  OTRA: 'outline',
}

export function CredentialCard({ credential, onEdit, onDelete }: CredentialCardProps) {
  const [isRevealing, setIsRevealing] = useState(false)
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [copiedField, setCopiedField] = useState<'username' | 'password' | null>(null)

  const handleRevealPassword = async () => {
    if (revealedPassword) {
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
        setTimeout(() => setShowPassword(false), 30000)
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
      toast.success(`${field === 'username' ? 'Usuario' : 'Contraseña'} copiado`)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      toast.error('Error al copiar')
    }
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 group">
      {/* Identity */}
      <div className="flex items-center gap-2 w-[220px] shrink-0 min-w-0">
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate">{credential.administratorName}</span>
        <Badge variant={TYPE_BADGE_VARIANT[credential.administratorType]} className="text-xs shrink-0 py-0">
          {TYPE_LABELS[credential.administratorType]}
        </Badge>
      </div>

      {/* Username */}
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <span className="text-xs text-muted-foreground shrink-0">Usuario:</span>
        <code className="text-xs font-mono truncate">{credential.username}</code>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => handleCopy(credential.username, 'username')}
        >
          {copiedField === 'username' ? (
            <Check className="h-3 w-3 text-green-600" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-border shrink-0" />

      {/* Password */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-muted-foreground">Clave:</span>
        <code className="text-xs font-mono w-[80px]">
          {showPassword && revealedPassword ? revealedPassword : '••••••••'}
        </code>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
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
        </Button>
        {revealedPassword && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
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

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
        {credential.portalUrl && (
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <a href={credential.portalUrl} target="_blank" rel="noopener noreferrer" title="Abrir portal">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onEdit(credential)}
          title="Editar"
        >
          <Edit className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(credential.id)}
          title="Eliminar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
