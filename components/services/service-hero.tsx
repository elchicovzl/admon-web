'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ServiceIcon } from './service-icon'
import { ServicePageData } from '@/data/services'
import { ArrowRight, MessageCircle } from 'lucide-react'
import { useSmoothScroll } from '@/hooks/use-smooth-scroll'

interface ServiceHeroProps {
  service: ServicePageData
}

export function ServiceHero({ service }: ServiceHeroProps) {
  const [isVisible, setIsVisible] = useState(false)
  const { scrollToSection } = useSmoothScroll()

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const handleContactClick = () => {
    scrollToSection('contacto')
  }

  const handleWhatsAppClick = () => {
    window.open('https://wa.me/573001234567?text=Hola, estoy interesado en el servicio de ' + service.name, '_blank')
  }

  return (
    <section className={`relative py-20 lg:py-28 bg-gradient-to-br ${service.theme.bgGradient} overflow-hidden`}>
      {/* Dot pattern background */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0,0,0,0.05) 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }}
      />

      {/* Floating decorative elements */}
      <div className={`absolute top-20 right-10 w-64 h-64 ${service.theme.iconBg} opacity-10 rounded-full blur-3xl animate-float`} />
      <div className={`absolute bottom-20 left-10 w-48 h-48 ${service.theme.iconBg} opacity-10 rounded-full blur-3xl animate-float`} style={{ animationDelay: '2s' }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className={`${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
            {service.badge && (
              <Badge className={`${service.theme.badgeBg} ${service.theme.badgeText} mb-6 px-4 py-1.5`}>
                {service.badge.text}
              </Badge>
            )}

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 font-serif">
              {service.name}
            </h1>

            <p className="text-xl text-gray-600 mb-4">
              {service.shortDescription}
            </p>

            <p className="text-lg text-gray-500 mb-8">
              {service.fullDescription}
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={handleContactClick}
                className="bg-black text-white hover:bg-gray-800 rounded-full px-8 py-6 text-lg"
              >
                Solicitar Cotización
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                onClick={handleWhatsAppClick}
                variant="outline"
                className="rounded-full px-8 py-6 text-lg border-2 hover:bg-green-50 hover:border-green-500 hover:text-green-600"
              >
                <MessageCircle className="mr-2 w-5 h-5" />
                WhatsApp
              </Button>
            </div>
          </div>

          {/* Icon/Visual */}
          <div className={`flex justify-center lg:justify-end ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '0.2s' }}>
            <div className="relative">
              {/* Glow effect */}
              <div className={`absolute inset-0 ${service.theme.iconBg} opacity-20 blur-3xl rounded-full scale-150`} />

              {/* Icon container */}
              <div className={`relative ${service.theme.iconBg} p-12 md:p-16 rounded-3xl shadow-2xl animate-pulse-glow`}>
                <ServiceIcon
                  iconType={service.iconType}
                  className="text-white"
                  size={120}
                />
              </div>

              {/* Decorative floating elements */}
              <div className={`absolute -top-4 -right-4 w-8 h-8 ${service.theme.iconBg} opacity-60 rounded-full animate-float`} />
              <div className={`absolute -bottom-6 -left-6 w-12 h-12 ${service.theme.iconBg} opacity-40 rounded-full animate-float`} style={{ animationDelay: '1s' }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
