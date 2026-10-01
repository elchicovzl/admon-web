'use client'

import { useState, useEffect } from 'react'
import { SectionLabel } from '@/components/ui/section-label'
import { ServicePageData } from '@/data/services'

interface ServiceProcessProps {
  service: ServicePageData
}

export function ServiceProcess({ service }: ServiceProcessProps) {
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

    const section = document.getElementById('process-section')
    if (section) observer.observe(section)

    return () => observer.disconnect()
  }, [])

  const processSteps = service.process

  if (!processSteps || processSteps.length === 0) {
    return null
  }

  return (
    <section id="process-section" className="py-20 bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <SectionLabel className="mb-4">Proceso</SectionLabel>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-figtree font-bold text-brand-navy mb-4">
            ¿Cómo Funciona?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Un proceso simple y eficiente para su tranquilidad
          </p>
        </div>

        {/* Process Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {processSteps.map((step, index) => (
            <div
              key={index}
              className={`
                relative
                ${isVisible ? 'animate-fade-in-up' : 'opacity-0'}
              `}
              style={{ animationDelay: `${index * 0.15}s` }}
            >
              {/* Connector line (except last) */}
              {index < processSteps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[60%] right-0 h-0.5 bg-gray-200" />
              )}

              {/* Card */}
              <div className={`
                relative bg-white rounded-2xl p-8 shadow-lg border border-gray-100
                hover:shadow-xl transition-shadow duration-300
              `}>
                {/* Step number */}
                <div className={`
                  bg-brand-gold w-16 h-16 rounded-2xl
                  flex items-center justify-center mb-6
                `}>
                  <span className="text-brand-navy text-2xl font-bold">{step.step}</span>
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-brand-navy mb-3">
                  {step.title}
                </h3>
                <p className="text-gray-600">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
