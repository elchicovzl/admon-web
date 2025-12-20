'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { ServiceIcon } from './service-icon'
import { ServicePageData } from '@/data/services'

interface ServiceBenefitsProps {
  service: ServicePageData
}

export function ServiceBenefits({ service }: ServiceBenefitsProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.1 }
    )

    const section = document.getElementById('benefits-section')
    if (section) observer.observe(section)

    return () => observer.disconnect()
  }, [])

  return (
    <section id="benefits-section" className="py-20 bg-white relative">
      {/* Subtle dot pattern */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0,0,0,0.03) 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge className={`${service.theme.badgeBg} ${service.theme.badgeText} mb-4`}>
            Beneficios
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 font-serif">
            ¿Por Qué Elegirnos?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Delegar su gestión en nosotros es una decisión estratégica
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {service.benefits.map((benefit, index) => (
            <div
              key={index}
              className={`
                group relative bg-white rounded-2xl p-8 shadow-lg border border-gray-100
                hover:shadow-xl hover:-translate-y-1 transition-all duration-500
                ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}
              `}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Icon */}
              <div className={`
                bg-gradient-to-br ${service.theme.iconBg.replace('bg-', 'from-')} to-${service.theme.primary}-600
                p-4 rounded-xl inline-flex mb-6
                group-hover:scale-110 transition-transform duration-300
              `}>
                <ServiceIcon
                  iconType={benefit.icon}
                  className="text-white"
                  size={28}
                />
              </div>

              {/* Content */}
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                {benefit.title}
              </h3>
              <p className="text-gray-600">
                {benefit.description}
              </p>

              {/* Checkmark indicator */}
              <div className={`
                absolute top-4 right-4 w-6 h-6 rounded-full bg-green-100
                flex items-center justify-center
              `}>
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
