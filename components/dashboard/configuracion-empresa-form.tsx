'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  configuracionEmpresaSchema,
  type ConfiguracionEmpresaInput,
} from '@/lib/validations/configuracion-empresa.schema'
import { updateConfiguracionEmpresa } from '@/lib/actions/configuracion-empresa.actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface ConfiguracionEmpresaFormProps {
  initialValues: ConfiguracionEmpresaInput
}

const CAMPOS: ReadonlyArray<{
  name: keyof ConfiguracionEmpresaInput
  label: string
  placeholder: string
}> = [
  { name: 'razonSocial', label: 'Razón social', placeholder: 'Nombre legal de la empresa' },
  { name: 'nit', label: 'NIT', placeholder: '900123456-7' },
  { name: 'direccion', label: 'Dirección', placeholder: 'Calle 1 # 2-3' },
  { name: 'ciudad', label: 'Ciudad', placeholder: 'Bogotá' },
  { name: 'telefono', label: 'Teléfono', placeholder: '3000000000' },
  { name: 'email', label: 'Correo electrónico', placeholder: 'contacto@empresa.co' },
]

export function ConfiguracionEmpresaForm({ initialValues }: ConfiguracionEmpresaFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ConfiguracionEmpresaInput>({
    resolver: zodResolver(configuracionEmpresaSchema),
    defaultValues: initialValues,
  })

  const onSubmit = async (data: ConfiguracionEmpresaInput) => {
    setIsSubmitting(true)
    try {
      const result = await updateConfiguracionEmpresa(data)

      if (result.success) {
        toast.success(result.message || 'Datos de la empresa actualizados')
        form.reset(data)
        router.refresh()
      } else {
        toast.error(result.error || 'Error al actualizar los datos de la empresa')
      }
    } catch {
      toast.error('Error al actualizar los datos de la empresa')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Datos de la empresa</CardTitle>
        <CardDescription>
          Estos datos aparecen en el PDF de los recibos de pago
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {CAMPOS.map(({ name, label, placeholder }) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                      <Input placeholder={placeholder} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting || !form.formState.isDirty}>
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
