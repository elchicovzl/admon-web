'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createCredential, updateCredential } from '@/lib/actions'
import { createCredentialSchema, type CreateCredentialInput } from '@/lib/validations/credential.schema'
import type { SafeClientCredential } from '@/lib/types/client.types'
import { AdministratorType } from '@prisma/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface CredentialFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  editCredential?: SafeClientCredential | null
  onCredentialCreated?: (credential: SafeClientCredential) => void
  onCredentialUpdated?: (credentialId: string, updates: Partial<SafeClientCredential>) => void
}

export function CredentialFormDialog({
  open,
  onOpenChange,
  clientId,
  editCredential,
  onCredentialCreated,
  onCredentialUpdated,
}: CredentialFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const isEditMode = !!editCredential

  const form = useForm<CreateCredentialInput>({
    resolver: zodResolver(createCredentialSchema),
    defaultValues: {
      clientId,
      administratorName: '',
      administratorType: AdministratorType.EPS,
      username: '',
      password: '',
      portalUrl: '',
      notes: '',
    },
  })

  // Update form when editCredential changes
  useEffect(() => {
    if (editCredential) {
      form.reset({
        clientId,
        administratorName: editCredential.administratorName,
        administratorType: editCredential.administratorType,
        username: editCredential.username,
        password: '', // Don't pre-fill password in edit mode
        portalUrl: editCredential.portalUrl || '',
        notes: editCredential.notes || '',
      })
    } else {
      form.reset({
        clientId,
        administratorName: '',
        administratorType: AdministratorType.EPS,
        username: '',
        password: '',
        portalUrl: '',
        notes: '',
      })
    }
  }, [editCredential, clientId, form])

  async function onSubmit(data: CreateCredentialInput) {
    setIsLoading(true)

    try {
      let result

      if (isEditMode && editCredential) {
        // If password is empty in edit mode, don't update it
        const updateData = { ...data }
        if (!updateData.password) {
          delete updateData.password
        }

        result = await updateCredential(editCredential.id, updateData)

        if (result.success) {
          toast.success(result.message || 'Credencial actualizada exitosamente')
          if (result.data) {
            onCredentialUpdated?.(editCredential.id, result.data)
          }
        } else {
          toast.error(result.error || 'Error al actualizar credencial')
        }
      } else {
        result = await createCredential(data)

        if (result.success) {
          toast.success(result.message || 'Credencial creada exitosamente')
          if (result.data) {
            onCredentialCreated?.(result.data)
          }
        } else {
          toast.error(result.error || 'Error al crear credencial')
        }
      }

      if (result.success) {
        form.reset()
        onOpenChange(false)
      }
    } catch (error) {
      console.error('Submit credential error:', error)
      toast.error('Error inesperado al procesar solicitud')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Editar Credencial' : 'Agregar Credencial de Administradora'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Actualiza la información de la credencial.'
              : 'Guarda las credenciales de acceso a portales de administradoras (EPS, AFP, ARL, etc.).'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="administratorName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la Administradora</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Sura EPS, Porvenir AFP, Positiva ARL"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="administratorType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Administradora</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={AdministratorType.EPS}>
                        EPS (Entidad Promotora de Salud)
                      </SelectItem>
                      <SelectItem value={AdministratorType.AFP}>
                        AFP (Administradora de Fondos de Pensiones)
                      </SelectItem>
                      <SelectItem value={AdministratorType.ARL}>
                        ARL (Administradora de Riesgos Laborales)
                      </SelectItem>
                      <SelectItem value={AdministratorType.CCF}>
                        CCF (Caja de Compensación Familiar)
                      </SelectItem>
                      <SelectItem value={AdministratorType.PILA_OPERATOR}>
                        Operador PILA
                      </SelectItem>
                      <SelectItem value={AdministratorType.OTRA}>
                        Otra
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuario / Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="usuario@email.com"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Contraseña
                      {isEditMode && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (dejar vacío para no cambiar)
                        </span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={isEditMode ? '••••••••' : 'Contraseña'}
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="portalUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL del Portal (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://portal.sura.com"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Link directo al portal de login de la administradora
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Información adicional, preguntas de seguridad, etc."
                      className="min-h-[80px] resize-none"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? 'Actualizar' : 'Guardar Credencial'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
