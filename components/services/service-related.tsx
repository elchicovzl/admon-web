'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ServiceIcon } from './service-icon'
import { ServicePageData, getRelatedServices } from '@/data/services'
import { ArrowRight } from 'lucide-react'

interface ServiceRelatedProps {
  currentSlug: string
}

export function ServiceRelated({ currentSlug }: ServiceRelatedProps) {
  const [isVisible, setIsVisible] = useState(false)
  const relatedServices = getRelatedServices(currentSlug, 3)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.1 }
    )

    const section = document.getElementById('related-section')
    if (section) observer.observe(section)

    return () => observer.disconnect()
  }, [])

  if (relatedServices.length === 0) {
    return null
  }

  return (
    <section id="related-section" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge className="bg-gray-200 text-gray-700 mb-4">
            Más Servicios
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 font-serif">
            Otros Servicios
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Descubra nuestras otras soluciones para su tranquilidad
          </p>
        </div>

        {/* Related Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {relatedServices.map((service, index) => (
            <Link
              key={service.slug}
              href={`/servicios/${service.slug}`}
              className={`
                group block bg-white rounded-2xl p-8 shadow-lg border border-gray-100
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
                  iconType={service.iconType}
                  className="text-white"
                  size={28}
                />
              </div>

              {/* Content */}
              <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-gray-700 transition-colors">
                {service.name}
              </h3>
              <p className="text-gray-600 mb-4">
                {service.shortDescription}
              </p>

              {/* Link indicator */}
              <div className={`flex items-center ${service.theme.accentColor} font-medium`}>
                <span>Conocer más</span>
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
