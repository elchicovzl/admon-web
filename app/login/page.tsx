import { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Iniciar Sesión | Administración Segura',
  description: 'Accede al panel administrativo de Administración Segura',
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-[#020617] via-[#1e3a8a] to-[#172554] p-4 overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl animate-float" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl animate-float"
          style={{ animationDelay: '2s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 w-64 h-64 bg-[#F1AD32]/10 rounded-full blur-3xl animate-float"
          style={{ animationDelay: '4s' }}
        />
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md">
        <LoginForm />

        {/* Test credentials - styled to match theme */}
        <div className="mt-8 text-center">
          <div className="inline-block bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-6 py-4">
            <p className="text-white/50 text-xs font-medium mb-2">Credenciales de prueba:</p>
            <div className="space-y-1 font-mono text-xs">
              <p className="text-white/70">
                <span className="text-[#F1AD32]">Admin:</span> admin@admon.com / admin123
              </p>
              <p className="text-white/70">
                <span className="text-[#F1AD32]">Manager:</span> manager@admon.com / manager123
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
