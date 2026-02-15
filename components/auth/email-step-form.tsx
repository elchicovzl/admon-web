'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { requestOtp } from '@/lib/actions'
import {
  requestOtpSchema,
  type RequestOtpInput,
} from '@/lib/validations/auth.schema'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Loader2, Mail } from 'lucide-react'

interface EmailStepFormProps {
  onOtpSent: (email: string) => void
}

export function EmailStepForm({ onOtpSent }: EmailStepFormProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<RequestOtpInput>({
    resolver: zodResolver(requestOtpSchema),
    defaultValues: {
      email: '',
    },
  })

  async function onSubmit(data: RequestOtpInput) {
    setIsLoading(true)

    try {
      const result = await requestOtp(data)

      if (result.success) {
        toast.success('Código enviado', {
          description: 'Revisa tu correo electrónico',
        })
        onOtpSent(data.email)
      } else {
        toast.error(result.error || 'Error al enviar código')
      }
    } catch (error) {
      console.error('Request OTP error:', error)
      toast.error('Error de conexión. Verifica tu internet')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-white/90">
                Email
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="tu@email.com"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  disabled={isLoading}
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:border-[#F1AD32] focus:ring-[#F1AD32] transition-all duration-300 hover:bg-white/10"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-red-300" />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full bg-[#F1AD32] hover:bg-[#f59e0b] text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando código...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Enviar código
            </>
          )}
        </Button>

        <p className="text-center text-xs text-white/60 mt-4">
          Te enviaremos un código de 6 dígitos a tu email
        </p>
      </form>
    </Form>
  )
}
