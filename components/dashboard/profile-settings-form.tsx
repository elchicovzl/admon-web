'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateProfileSchema, type UpdateProfileInput } from '@/lib/validations/user.schema'
import { updateProfile } from '@/lib/actions/user.actions'
import { AvatarUpload } from '@/components/dashboard/avatar-upload'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface ProfileSettingsFormProps {
  user: {
    name: string | null
    email: string
    image: string | null
    role: string
  }
}

export function ProfileSettingsForm({ user }: ProfileSettingsFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: user.name || '',
    },
  })

  const onSubmit = async (data: UpdateProfileInput) => {
    setIsSubmitting(true)
    try {
      const result = await updateProfile(data)

      if (result.success) {
        toast.success(result.message || 'Perfil actualizado')
        router.refresh()
      } else {
        toast.error(result.error || 'Error al actualizar perfil')
      }
    } catch {
      toast.error('Error al actualizar perfil')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getRoleBadge = (role: string) => {
    if (role === 'SUPER_ADMIN') {
      return <Badge variant="default">Super Admin</Badge>
    }
    return <Badge variant="secondary">Manager</Badge>
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Información del Perfil</CardTitle>
        <CardDescription>
          Actualiza tu foto de perfil y datos básicos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start gap-6">
          <AvatarUpload
            currentImage={user.image}
            userName={user.name}
            userEmail={user.email}
          />
          <div className="flex-1 space-y-1 pt-2">
            <h3 className="font-semibold">{user.name || 'Sin nombre'}</h3>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <div className="pt-1">{getRoleBadge(user.role)}</div>
          </div>
        </div>

        <Separator />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Tu nombre completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isSubmitting || !form.formState.isDirty}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar cambios
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
