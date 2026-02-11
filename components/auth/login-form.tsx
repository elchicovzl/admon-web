'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { login } from '@/lib/actions'
import { loginSchema, type LoginInput } from '@/lib/validations/auth.schema'
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
import { Loader2 } from 'lucide-react'

export function LoginForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(data: LoginInput) {
    setIsLoading(true)

    try {
      const result = await login(data)

      if (result.success) {
        toast.success(result.message || 'Inicio de sesión exitoso')
        router.push('/dashboard')
        router.refresh()
      } else {
        toast.error(result.error || 'Error al iniciar sesión')
      }
    } catch (error) {
      console.error('Login error:', error)
      toast.error('Error inesperado al iniciar sesión')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 sm:p-12 animate-fade-in-up">
      {/* Logo/Brand header */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-lg p-3">
          <Image
            src="/images/logoadmon2.webp"
            alt="Administración Segura Logo"
            width={80}
            height={80}
            className="w-full h-full object-contain"
            priority
          />
        </div>
        <h1 className="text-4xl font-bold text-white text-center font-figtree">
          Bienvenido
        </h1>
        <p className="text-white/70 text-center mt-2 font-inter">
          Ingresa tus credenciales para acceder al panel
        </p>
      </div>

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
                    disabled={isLoading}
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:border-[#F1AD32] focus:ring-[#F1AD32] transition-all duration-300 hover:bg-white/10"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-red-300" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-white/90">
                  Contraseña
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="••••••••"
                    type="password"
                    autoComplete="current-password"
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
                Iniciando sesión...
              </>
            ) : (
              'Iniciar sesión'
            )}
          </Button>
        </form>
      </Form>
    </div>
  )
}
