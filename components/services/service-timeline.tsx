'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { ServicePageData } from '@/data/services'
import { ArrowRight } from 'lucide-react'

interface ServiceTimelineProps {
  service: ServicePageData
}

const colorMap: Record<string, { bg: string; border: string; text: string }> = {
  gray: { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-700' },
  blue: { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700' },
  purple: { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-700' },
  amber: { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-700' },
  green: { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700' },
}

export function ServiceTimeline({ service }: ServiceTimelineProps) {
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

    const section = document.getElementById('timeline-section')
    if (section) observer.observe(section)

    return () => observer.disconnect()
  }, [])

  const timelineItems = service.timeline

  if (!timelineItems || timelineItems.length === 0) {
    return null
  }

  return (
    <section id="timeline-section" className={`py-20 ${service.theme.lightBg}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge className={`${service.theme.badgeBg} ${service.theme.badgeText} mb-4`}>
            Conoce las Reglas
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 font-serif">
            Responsabilidad de Pagos
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            La clave del éxito en un recobro es saber quién debe pagar en cada etapa
          </p>
        </div>

        {/* Timeline - Desktop (Horizontal) */}
        <div className="hidden lg:block">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 -translate-y-1/2" />

            {/* Timeline items */}
            <div className="relative flex justify-between">
              {timelineItems.map((item, index) => {
                const colors = colorMap[item.color] || colorMap.gray
                return (
                  <div
                    key={index}
                    className={`
                      relative flex flex-col items-center w-1/4 px-4
                      ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}
                    `}
                    style={{ animationDelay: `${index * 0.15}s` }}
                  >
                    {/* Circle */}
                    <div className={`
                      w-16 h-16 rounded-full ${colors.bg} border-4 ${colors.border}
                      flex items-center justify-center z-10 mb-4
                    `}>
                      <span className={`text-lg font-bold ${colors.text}`}>
                        {index + 1}
                      </span>
                    </div>

                    {/* Arrow (except last) */}
                    {index < timelineItems.length - 1 && (
                      <div className="absolute top-8 left-[60%] text-gray-300">
                        <ArrowRight className="w-6 h-6" />
                      </div>
                    )}

                    {/* Content card */}
                    <div className={`
                      bg-white rounded-xl p-6 shadow-lg border ${colors.border}
                      text-center w-full
                    `}>
                      <div className={`text-sm font-bold ${colors.text} mb-2`}>
                        {item.period}
                      </div>
                      <div className="text-lg font-bold text-gray-900 mb-2">
                        {item.responsible}
                      </div>
                      <p className="text-sm text-gray-600">
                        {item.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Timeline - Mobile (Vertical) */}
        <div className="lg:hidden">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute top-0 bottom-0 left-8 w-1 bg-gray-200" />

            {/* Timeline items */}
            <div className="space-y-8">
              {timelineItems.map((item, index) => {
                const colors = colorMap[item.color] || colorMap.gray
                return (
                  <div
                    key={index}
                    className={`
                      relative flex gap-6
                      ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}
                    `}
                    style={{ animationDelay: `${index * 0.15}s` }}
                  >
                    {/* Circle */}
                    <div className={`
                      w-16 h-16 rounded-full ${colors.bg} border-4 ${colors.border}
                      flex items-center justify-center z-10 flex-shrink-0
                    `}>
                      <span className={`text-lg font-bold ${colors.text}`}>
                        {index + 1}
                      </span>
                    </div>

                    {/* Content card */}
                    <div className={`
                      bg-white rounded-xl p-6 shadow-lg border ${colors.border}
                      flex-1
                    `}>
                      <div className={`text-sm font-bold ${colors.text} mb-2`}>
                        {item.period}
                      </div>
                      <div className="text-lg font-bold text-gray-900 mb-2">
                        {item.responsible}
                      </div>
                      <p className="text-sm text-gray-600">
                        {item.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Additional note */}
        <div className={`
          mt-12 text-center p-6 bg-white rounded-xl shadow-lg border ${service.theme.borderColor}
          ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}
        `}
        style={{ animationDelay: '0.6s' }}
        >
          <p className={`text-lg font-medium ${service.theme.accentColor}`}>
            Dominamos estas reglas para que usted no tenga que hacerlo.
          </p>
          <p className="text-gray-600 mt-2">
            Nos encargamos de vigilar cada detalle para que no pierda su dinero.
          </p>
        </div>
      </div>
    </section>
  )
}
