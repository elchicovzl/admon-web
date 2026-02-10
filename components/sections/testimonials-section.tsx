"use client"

import TestimonialSlider from '@/components/testimonial-slider-new'
import { Star } from 'lucide-react'

export default function TestimonialsSection() {
  return (
    <section
      className="relative py-20 bg-gradient-to-br from-[#020617] via-[#1e3a8a] to-[#172554] overflow-hidden"
      id="testimonials"
    >
      {/* Background decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -right-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-20 -left-20 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16 px-4">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 shadow-sm text-sm font-medium mb-6">
            <Star className="w-4 h-4 text-orange-400 fill-orange-400" />
            <span className="text-white">CONFIANZA DE EMPRESAS LÍDERES</span>
          </div>

          {/* Title */}
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight max-w-4xl mx-auto mb-4">
            Ayudando a empresas como la tuya a{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-cyan-400 to-blue-400">
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
