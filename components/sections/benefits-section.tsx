'use client'

import { Search, ArrowRight } from 'lucide-react'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import { useSmoothScroll } from '@/hooks/use-smooth-scroll'
import { Button } from '@/components/ui/button'
import { BenefitsStory } from './benefits/benefits-story'
import { BenefitsList } from './benefits/benefits-list'

export default function BenefitsSection() {
  const { scrollToSection } = useSmoothScroll()
  const reduceMotion = useReducedMotion()

  const reveal: Variants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  }

  return (
    <>
      {/* Intro Section */}
      <section className="relative grid min-h-[400px] grid-cols-1 overflow-hidden border-b border-brand-gold/20 bg-gradient-to-b from-white to-brand-gold-soft/40 lg:grid-cols-2">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-gold/15 blur-3xl" />
        {/* Left Column */}
        <div className="relative flex flex-col items-center justify-center p-8 lg:p-16 text-center lg:text-left">
          <div className="max-w-md mx-auto">
            <div className="mb-6">
              <Search aria-hidden strokeWidth={1.5} className="mx-auto h-14 w-14 text-brand-gold lg:mx-0" />
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-figtree font-bold text-brand-navy leading-tight">
              Obtén tranquilidad y cumplimiento total en Seguridad Social para tu empresa y trabajadores independientes.
            </h2>
          </div>
        </div>

        {/* Right Column */}
        <div className="relative flex flex-col items-center justify-center p-8 lg:p-16 text-center lg:text-left">
          <div className="max-w-md mx-auto">
            <p className="text-xl text-gray-600 mb-8">
              Maneja todos los aspectos de la Seguridad Social sin complicaciones. Nos encargamos de afiliaciones, liquidaciones PILA 
              y recobros, para que te enfoques en hacer crecer tu negocio con total tranquilidad.
            </p>
            <Button
              variant="brand"
              size="xl"
              onClick={() => scrollToSection('contacto')}
              className="cursor-pointer"
            >
              Consultoría GRATIS
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative overflow-x-clip bg-white py-20 lg:py-28" id="benefits">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={reveal}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            className="mb-12 max-w-3xl lg:mb-8"
          >
            <p className="mb-3 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-brand-gold before:h-px before:w-8 before:bg-brand-gold">
              Beneficios
            </p>
            <h2 className="font-figtree text-3xl font-bold leading-tight text-brand-navy md:text-4xl lg:text-5xl">
              Simplifica tu Seguridad Social con Nuestros Servicios Especializados
            </h2>
          </motion.div>

          <div className="hidden lg:block">
            <BenefitsStory />
          </div>
          <div className="lg:hidden">
            <BenefitsList />
          </div>
        </div>
      </section>
    </>
  )
}
