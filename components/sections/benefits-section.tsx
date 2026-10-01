'use client'

import { features } from '@/data/features'
import { Search, ArrowRight, TrendingUp, DollarSign } from 'lucide-react'
import Image from 'next/image'
import { useSmoothScroll } from '@/hooks/use-smooth-scroll'
import { Button } from '@/components/ui/button'
import { SectionLabel } from '@/components/ui/section-label'

const iconMap = {
  search: Search,
  'trending-up': TrendingUp,
  'dollar-sign': DollarSign,
}

export default function BenefitsSection() {
  const { scrollToSection } = useSmoothScroll()
  return (
    <>
      {/* Intro Section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 min-h-[400px] border-b border-gray-200">
        {/* Left Column */}
        <div className="bg-white flex flex-col items-center justify-center p-8 lg:p-16 text-center lg:text-left">
          <div className="max-w-md mx-auto">
            <div className="mb-6">
              <div className="inline-flex p-4 bg-brand-gold-soft text-brand-navy rounded-2xl">
                <Search className="w-12 h-12" />
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-figtree font-bold text-brand-navy leading-tight">
              Obtén tranquilidad y cumplimiento total en Seguridad Social para tu empresa y trabajadores independientes.
            </h2>
          </div>
        </div>

        {/* Right Column */}
        <div className="bg-white flex flex-col items-center justify-center p-8 lg:p-16 text-center lg:text-left">
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
      <section className="py-20 bg-white" id="benefits">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <SectionLabel className="mb-4">Beneficios</SectionLabel>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-figtree font-bold text-brand-navy leading-tight">
              Simplifica tu Seguridad Social con Nuestros Servicios Especializados
            </h2>
          </div>

          <div className="space-y-16">
            {features.map((feature, index) => {
              const IconComponent = iconMap[feature.icon as keyof typeof iconMap]
              const isEven = index % 2 === 0

              return (
                <div 
                  key={feature.id}
                  className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${
                    isEven ? '' : 'lg:grid-flow-col-dense'
                  }`}
                >
                  <div className={isEven ? 'lg:order-1' : 'lg:order-2'}>
                    <h3 className="text-3xl font-figtree font-bold text-brand-navy mb-4">{feature.title}</h3>
                    <p className="text-lg text-gray-600">{feature.description}</p>
                  </div>
                  
                  <div className={`relative w-full h-80 lg:h-96 rounded-lg overflow-hidden shadow-lg ${
                    isEven ? 'lg:order-2' : 'lg:order-1'
                  }`}>
                    {/* Grid background */}
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `
                          linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
                        `,
                        backgroundSize: "20px 20px",
                      }}
                    />
                    <Image
                      src={feature.image || '/placeholder.svg?height=400&width=400'}
                      alt={feature.title}
                      width={400}
                      height={400}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    
                    {/* Stats overlay */}
                    {feature.stats && (
                      <div className={`absolute ${
                        index === 0 ? 'bottom-8 right-8' :
                        index === 1 ? 'top-8 right-8' :
                        'top-8 left-8'
                      } bg-white border border-gray-200 rounded-lg p-3 shadow-md`}>
                        {index === 0 && (
                          <div className="flex items-center">
                            <ArrowRight className="w-5 h-5 rotate-[-90deg] mr-2 text-brand-gold" />
                            <span className="text-2xl font-bold text-brand-navy">{feature.stats.value}</span>
                          </div>
                        )}
                        {index === 1 && (
                          <>
                            <div className="flex items-center">
                              <span className="text-xl font-bold text-brand-navy mr-2">AOV</span>
                              <TrendingUp className="w-5 h-5 text-brand-gold" />
                            </div>
                            <div className="text-2xl font-bold text-brand-navy">{feature.stats.value}</div>
                          </>
                        )}
                        {index === 2 && (
                          <>
                            <div className="flex items-center mb-1">
                              <DollarSign className="w-5 h-5 text-brand-gold mr-1" />
                              <span className="text-sm font-bold text-brand-navy">Hoy 9:45am</span>
                            </div>
                            <div className="w-24 h-12 relative">
                              <svg viewBox="0 0 100 50" className="w-full h-full">
                                <polyline
                                  points="5,45 25,20 45,35 65,10 85,40 95,25"
                                  fill="none"
                                  stroke="#E0A025"
                                  strokeWidth="2"
                                />
                                <circle cx="65" cy="10" r="3" fill="#E0A025" />
                              </svg>
                            </div>
                          </>
                        )}
                        <div className="text-sm text-gray-800">{feature.stats.label}</div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}