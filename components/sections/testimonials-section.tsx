"use client"

import TestimonialSlider from '@/components/testimonial-slider-new'
import { Star } from 'lucide-react'
import { SectionLabel } from '@/components/ui/section-label'

export default function TestimonialsSection() {
  return (
    <section
      className="relative py-20 bg-gradient-to-br from-brand-navy to-brand-navy-deep overflow-hidden"
      id="testimonials"
    >
      {/* Background decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-20 -left-20 w-96 h-96 bg-brand-gold/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16 px-4">
          {/* Badge */}
          <SectionLabel
            tone="dark"
            className="mb-6"
            icon={<Star className="w-3.5 h-3.5 text-brand-gold fill-brand-gold" />}
          >
            Confianza de empresas líderes
          </SectionLabel>

          {/* Title */}
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-figtree font-bold text-white leading-tight max-w-4xl mx-auto mb-4">
            Ayudando a empresas como la tuya a{" "}
            <span className="text-brand-gold">
              simplificar su Seguridad Social
            </span>
          </h2>

          {/* Subtitle */}
          <p className="text-lg text-white/80 max-w-2xl mx-auto">
            Historias reales de clientes satisfechos con nuestros servicios
          </p>
        </div>

        {/* Testimonial Slider */}
        <TestimonialSlider />
      </div>
    </section>
  )
}
