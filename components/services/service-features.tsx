'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { ServicePageData } from '@/data/services'
import { CheckCircle } from 'lucide-react'

interface ServiceFeaturesProps {
  service: ServicePageData
}

export function ServiceFeatures({ service }: ServiceFeaturesProps) {
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

    const section = document.getElementById('features-section')
    if (section) observer.observe(section)

    return () => observer.disconnect()
  }, [])

  return (
    <section id="features-section" className={`py-20 ${service.theme.lightBg}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge className={`${service.theme.badgeBg} ${service.theme.badgeText} mb-4`}>
            Servicios
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 font-serif">
            Servicios Especializados
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Ofrecemos soluciones completas adaptadas a sus necesidades
          </p>
        </div>

        {/* Features */}
        <div className="space-y-16">
          {service.features.map((feature, index) => {
            const isEven = index % 2 === 0
            return (
              <div
                key={index}
                className={`
                  grid grid-cols-1 lg:grid-cols-2 gap-12 items-center
                  ${isVisible ? (isEven ? 'animate-slide-in-left' : 'animate-slide-in-right') : 'opacity-0'}
                `}
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                {/* Content */}
                <div className={isEven ? '' : 'lg:order-2'}>
                  <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-lg text-gray-600 mb-6">
                    {feature.description}
                  </p>

                  {/* Included items */}
                  <ul className="space-y-3">
                    {feature.included.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start gap-3">
                        <CheckCircle className={`w-6 h-6 ${service.theme.accentColor} flex-shrink-0 mt-0.5`} />
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Visual/Card */}
                <div className={isEven ? 'lg:order-2' : ''}>
                  <div className={`
                    relative bg-white rounded-2xl p-0 shadow-xl border ${service.theme.borderColor}
                    overflow-hidden
                  `}>
                    {feature.image ? (
                      <div className="w-full h-64 relative">
                        <img
                          src={feature.image}
                          alt={feature.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                        <div className="absolute bottom-0 left-0 p-6 z-10 text-white">
                          <div className={`${service.theme.iconBg} w-12 h-12 rounded-xl flex items-center justify-center mb-4`}>
                            <span className="text-white text-xl font-bold">{index + 1}</span>
                          </div>
                          <h4 className="text-xl font-bold mb-2 text-white">{feature.title}</h4>
                          <p className="text-white/90 text-sm">{feature.description}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8">
                        {/* Decorative background */}
                        <div
                          className="absolute inset-0 opacity-30"
                          style={{
                            backgroundImage: 'linear-gradient(135deg, transparent 25%, rgba(0,0,0,0.02) 25%, rgba(0,0,0,0.02) 50%, transparent 50%, transparent 75%, rgba(0,0,0,0.02) 75%)',
                            backgroundSize: '20px 20px'
                          }}
                        />

                        <div className="relative">
                          <div className={`${service.theme.iconBg} w-16 h-16 rounded-xl flex items-center justify-center mb-6`}>
                            <span className="text-white text-2xl font-bold">{index + 1}</span>
                          </div>
                          <h4 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h4>
                          <p className="text-gray-600">{feature.description}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
