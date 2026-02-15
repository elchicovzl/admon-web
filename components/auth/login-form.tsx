'use client'

import { useState } from 'react'
import Image from 'next/image'
import { EmailStepForm } from './email-step-form'
import { OtpVerificationForm } from './otp-verification-form'

export function LoginForm() {
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')

  function handleOtpSent(userEmail: string) {
    setEmail(userEmail)
    setStep('otp')
  }

  function handleBack() {
    setStep('email')
    setEmail('')
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
          {step === 'email'
            ? 'Ingresa tu email para recibir un código de acceso'
            : 'Ingresa el código enviado a tu email'}
        </p>
      </div>

      {/* Multi-step form */}
      {step === 'email' ? (
        <EmailStepForm onOtpSent={handleOtpSent} />
      ) : (
        <OtpVerificationForm email={email} onBack={handleBack} />
      )}
    </div>
  )
}
