'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { ServiceIcon } from './service-icon'
import { ServicePageData } from '@/data/services'

interface ServiceAudienceProps {
  service: ServicePageData
}

export function ServiceAudience({ service }: ServiceAudienceProps) {
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

    const section = document.getElementById('audience-section')
    if (section) observer.observe(section)

    return () => observer.disconnect()
  }, [])

  return (
    <section id="audience-section" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge className={`${service.theme.badgeBg} ${service.theme.badgeText} mb-4`}>
            Para Quién
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 font-serif">
            ¿A Quiénes Ayudamos?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Nuestros servicios están diseñados para atender las necesidades específicas de cada cliente
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {service.targetAudience.map((audience, index) => (
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
                ${service.theme.iconBg} p-4 rounded-xl inline-flex mb-6
                group-hover:scale-110 transition-transform duration-300
              `}>
                <ServiceIcon
                  iconType={audience.icon}
                  className="text-white"
                  size={28}
                />
              </div>

              {/* Content */}
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                {audience.title}
              </h3>
              <p className="text-gray-600">
                {audience.description}
              </p>

              {/* Bottom gradient line on hover */}
              <div className={`
                absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl
                bg-gradient-to-r ${service.theme.iconBg.replace('bg-', 'from-')} to-transparent
                opacity-0 group-hover:opacity-100 transition-opacity duration-300
              `} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
