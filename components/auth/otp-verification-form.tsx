'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { verifyOtp, resendOtp } from '@/lib/actions'
import { Button } from '@/components/ui/button'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, RotateCw } from 'lucide-react'

interface OtpVerificationFormProps {
  email: string
  onBack: () => void
}

export function OtpVerificationForm({
  email,
  onBack,
}: OtpVerificationFormProps) {
  const router = useRouter()
  const [otpCode, setOtpCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // Countdown timer para resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown((prev) => prev - 1)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  async function handleVerify(code: string) {
    if (code.length !== 6) return

    setIsVerifying(true)

    try {
      const result = await verifyOtp({ email, code })

      if (result.success) {
        toast.success('¡Bienvenido!', {
          description: 'Acceso concedido',
        })
        router.push('/dashboard')
        router.refresh()
      } else {
        toast.error(result.error || 'Código inválido')
        setOtpCode('') // Limpiar campo
      }
    } catch (error) {
      console.error('Verify OTP error:', error)
      toast.error('Error de conexión')
      setOtpCode('')
    } finally {
      setIsVerifying(false)
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return

    try {
      const result = await resendOtp({ email })

      if (result.success) {
        toast.success('Código reenviado', {
          description: 'Revisa tu email nuevamente',
        })
        setResendCooldown(60) // 60 segundos de cooldown
      } else {
        if (result.cooldownSeconds) {
          setResendCooldown(result.cooldownSeconds)
        }
        toast.error(result.error || 'Error al reenviar código')
      }
    } catch (error) {
      console.error('Resend OTP error:', error)
      toast.error('Error al reenviar código')
    }
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="text-white/70 hover:text-white hover:bg-white/10"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Cambiar email
      </Button>

      {/* Email display */}
      <div className="text-center">
        <p className="text-white/70 text-sm mb-1">Código enviado a:</p>
        <p className="text-white font-semibold">{email}</p>
      </div>

      {/* OTP Input */}
      <div className="flex flex-col items-center space-y-4">
        <InputOTP
          maxLength={6}
          value={otpCode}
          onChange={(value) => {
            setOtpCode(value)
            if (value.length === 6) {
              handleVerify(value)
            }
          }}
          disabled={isVerifying}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>

        {isVerifying && (
          <div className="flex items-center text-white/70 text-sm">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Verificando...
          </div>
        )}
      </div>

      {/* Resend button */}
      <div className="text-center">
        {resendCooldown > 0 ? (
          <p className="text-white/50 text-sm">
            Reenviar código en {resendCooldown}s
          </p>
        ) : (
          <Button
            variant="link"
            onClick={handleResend}
            className="text-[#F1AD32] hover:text-[#f59e0b]"
          >
            <RotateCw className="mr-2 h-4 w-4" />
            Reenviar código
          </Button>
        )}
      </div>

      <p className="text-center text-xs text-white/60">
        El código expira en 5 minutos
      </p>
    </div>
  )
}
