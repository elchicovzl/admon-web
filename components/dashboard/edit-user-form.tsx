'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateUser } from '@/lib/actions/user.actions'
import { updateUserSchema, type UpdateUserInput } from '@/lib/validations/user.schema'
import type { SafeUser } from '@/lib/types/auth.types'
import { AvatarUpload } from '@/components/dashboard/avatar-upload'
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
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface EditUserFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: SafeUser
  onUserUpdated?: (user: SafeUser) => void
}

export function EditUserForm({ open, onOpenChange, user, onUserUpdated }: EditUserFormProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      name: user.name || '',
      email: user.email,
    },
  })

  async function onSubmit(data: UpdateUserInput) {
    setIsLoading(true)

    try {
      const result = await updateUser(user.id, data)

      if (result.success) {
        toast.success(result.message || 'Usuario actualizado exitosamente')
        if (result.data) {
          onUserUpdated?.(result.data)
        }
        onOpenChange(false)
      } else {
        toast.error(result.error || 'Error al actualizar usuario')
      }
    } catch (error) {
      console.error('Update user error:', error)
      toast.error('Error inesperado al actualizar usuario')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Editar Usuario</DialogTitle>
          <DialogDescription>
            Modifica la información del usuario
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center">
          <AvatarUpload
            currentImage={user.image ? `/api/avatar/${user.id}` : null}
            userName={user.name}
            userEmail={user.email}
            targetUserId={user.id}
          />
        </div>

        <Separator />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre completo</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nombre del usuario"
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="correo@ejemplo.com"
                      type="email"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading || !form.formState.isDirty}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar cambios'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
