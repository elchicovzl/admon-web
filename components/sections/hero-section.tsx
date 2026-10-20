"use client"

import { Button } from '@/components/ui/button'
import { ArrowRight, Eye, TrendingUp } from 'lucide-react'
import { Typewriter } from 'react-simple-typewriter'
import { HeroDashboardMock } from '@/components/ui/hero-dashboard-mock'
import { SectionLabel } from '@/components/ui/section-label'
import Squares from '@/components/ui/squares-background'
import { memo } from 'react'

// Memoized hero content component to avoid duplication
const HeroContent = memo(({ isMobile }: { isMobile?: boolean }) => {
  const typewriterWords = [
    'EPS (Salud)',
    'ARL (Riesgos Laborales)',
    'Fondos de Pensiones',
    'CCF Caja de Compensación'
  ]

  return (
    <>
      <SectionLabel tone="dark" className="mb-6">Expertos en Seguridad Social</SectionLabel>

      <h1 className={`text-4xl md:text-5xl ${isMobile ? '' : 'lg:text-7xl'} font-bold text-white mb-6 leading-tight ${isMobile ? '' : 'tracking-tight'}`}>
        Soluciones en {isMobile && <br />}<span className="text-brand-gold">Seguridad Social</span> {!isMobile && 'para tu Futuro'}
      </h1>

      <p className={`text-lg ${isMobile ? 'md:text-xl' : 'md:text-2xl'} text-white/80 mb-8 ${isMobile ? 'max-w-2xl mx-auto' : 'max-w-lg'} leading-relaxed min-h-[3.5rem] ${isMobile ? 'md:min-h-[4rem]' : 'md:min-h-[4.5rem]'}`}>
        {isMobile ? 'Afiliacion a' : 'Expertos en afiliacion a'}{' '}
        <span className="font-semibold text-brand-gold inline-block min-h-[1.5em]">
          <Typewriter
            words={typewriterWords}
            loop={0}
            cursor
            cursorStyle="_"
            typeSpeed={70}
            deleteSpeed={50}
            delaySpeed={1000}
          />
        </span>
      </p>

      <div className={`flex flex-col ${isMobile ? 'gap-4 max-w-md mx-auto' : 'sm:flex-row gap-4'}`}>
        <a href="#contacto" className="cursor-pointer">
          <Button
            variant="brand"
            size="xl"
            className={`w-full ${isMobile ? '' : 'sm:w-auto'} cursor-pointer`}
          >
            Asesorias GRATIS
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </a>
        <a href="#features" className="cursor-pointer">
          <Button
            variant="brand-outline-light"
            size="xl"
            className={`w-full ${isMobile ? '' : 'sm:w-auto'} cursor-pointer`}
          >
            Servicios
            <Eye className="ml-2 w-5 h-5" />
          </Button>
        </a>
      </div>

      {!isMobile && (
        <div className="mt-10 flex items-center gap-4 text-white/70 text-sm">
          <p>Más de <span className="font-bold text-white">500+</span> empresas confían en nosotros</p>
        </div>
      )}
    </>
  )
})

HeroContent.displayName = 'HeroContent'

export default function HeroSection() {
  return (
    <section className="relative py-20 overflow-hidden bg-gradient-to-br from-brand-navy to-brand-navy-deep">
      {/* Decorative Gradient Blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-subtle-glow" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-brand-gold/15 rounded-full blur-3xl animate-subtle-glow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/5 rounded-full blur-3xl" />
      </div>

      {/* Squares Background */}
      <div className="absolute inset-0 opacity-20">
        <Squares
          direction="diagonal"
          speed={0.2}
          borderColor="rgba(255, 255, 255, 0.1)"
          squareSize={40}
          hoverFillColor="rgba(255, 255, 255, 0.05)"
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="relative z-10 text-left">
            <HeroContent />
          </div>

          {/* Right side: dashboard mock */}
          <div className="relative z-10 pb-10">
            <HeroDashboardMock />
          </div>
        </div>

        {/* Mobile Layout - copy with mock below */}
        <div className="lg:hidden text-center relative z-10">
          <HeroContent isMobile />
          <div className="mt-14 pb-6 text-left">
            <HeroDashboardMock />
          </div>
        </div>
      </div>
    </section>
  )
}