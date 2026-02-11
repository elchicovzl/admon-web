"use client"

import { Button } from '@/components/ui/button'
import { ArrowRight, Eye, TrendingUp } from 'lucide-react'
import { Typewriter } from 'react-simple-typewriter'
import ServicesSlider from '@/components/ui/services-slider'
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
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-200 text-sm font-medium mb-6 backdrop-blur-sm ${isMobile ? 'justify-center' : ''}`}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
        </span>
        Soluciones Integrales 2024
      </div>

      <h1 className={`text-4xl md:text-5xl ${isMobile ? '' : 'lg:text-7xl'} font-bold text-white mb-6 leading-tight ${isMobile ? '' : 'tracking-tight'}`}>
        Soluciones en {isMobile && <br />}<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">Seguridad Social</span> {!isMobile && 'para tu Futuro'}
      </h1>

      <p className={`text-lg ${isMobile ? 'md:text-xl' : 'md:text-2xl'} text-blue-100/90 mb-8 ${isMobile ? 'max-w-2xl mx-auto' : 'max-w-lg'} leading-relaxed min-h-[${isMobile ? '60px' : '72px'}] ${isMobile ? 'md:min-h-[72px]' : 'md:min-h-[120px]'}`}>
        {isMobile ? 'Afiliacion a' : 'Expertos en afiliacion a'}{' '}
        <span className="font-semibold text-[#F1AD32] inline-block min-h-[1.5em]">
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
            size="lg"
            className={`bg-white text-blue-900 hover:bg-blue-50 hover:text-blue-950 rounded-full px-8 ${isMobile ? 'py-4' : 'py-6'} text-lg font-bold w-full ${isMobile ? '' : 'sm:w-auto'} cursor-pointer ${isMobile ? 'shadow-lg hover:shadow-xl' : 'shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] transform hover:-translate-y-1'} transition-all duration-300 border-0`}
          >
            Asesorias GRATIS
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </a>
        <a href="#features" className="cursor-pointer">
          <Button
            size="lg"
            variant="outline"
            className={`rounded-full px-8 ${isMobile ? 'py-4' : 'py-6'} text-lg font-medium border border-white/20 bg-white/5 backdrop-blur-sm text-white hover:bg-white/10 hover:border-white/40 w-full ${isMobile ? '' : 'sm:w-auto'} cursor-pointer transition-all duration-300`}
          >
            Servicios
            <Eye className="ml-2 w-5 h-5" />
          </Button>
        </a>
      </div>

      {!isMobile && (
        <div className="mt-10 flex items-center gap-4 text-blue-200/80 text-sm">
          <p>Más de <span className="font-bold text-white">500+</span> empresas confían en nosotros</p>
        </div>
      )}
    </>
  )
})

HeroContent.displayName = 'HeroContent'

export default function HeroSection() {
  return (
    <section className="relative py-20 overflow-hidden bg-gradient-to-br from-[#020617] via-[#1e3a8a] to-[#172554]">
      {/* Decorative Gradient Blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl animate-subtle-glow" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-[#F1AD32]/20 rounded-full blur-3xl animate-subtle-glow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-3xl" />
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

          {/* Right side with new services slider */}
          <div className="relative z-10 flex justify-center lg:justify-end">
            <div className="relative w-full">
              {/* Subtle gradient backdrop */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 rounded-3xl blur-2xl" />

              {/* Services Slider */}
              <div className="relative z-10">
                <ServicesSlider />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Layout - Text Only */}
        <div className="lg:hidden text-center relative z-10">
          <HeroContent isMobile />
        </div>
      </div>
    </section>
  )
}