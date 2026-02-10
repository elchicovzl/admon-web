"use client"

import { trustedBrands } from '@/data/features'
import { Star } from 'lucide-react'

export default function TrustedBrandsSection() {
  return (
    <section className="relative py-20 bg-gradient-to-r from-orange-50 via-blue-50 to-orange-50 overflow-hidden border-y border-orange-100/50">
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(241, 173, 50, 0.08) 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-orange-200/50 shadow-sm text-sm font-medium mb-4">
            <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
            <span className="text-gray-700">Confianza Empresarial</span>
          </div>

          {/* Title */}
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Empresas que{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-blue-600 to-orange-500">
              Confían en Nosotros
            </span>
          </h2>

          {/* Subtitle */}
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Más de 500 empresas han confiado en nuestra experiencia
          </p>
        </div>

        {/* Marquee Container */}
        <div className="relative">
          {/* Fade overlays matching gradient background */}
          <div className="absolute left-0 top-0 w-32 h-full bg-gradient-to-r from-orange-50 via-orange-50/90 to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 w-32 h-full bg-gradient-to-l from-orange-50 via-orange-50/90 to-transparent z-10 pointer-events-none" />

          {/* Scrolling content with glassmorphic cards */}
          <div className="animate-marquee hover:pause-animation">
            <div className="flex items-center gap-6">
              {/* Triple the brands for smooth infinite scroll */}
              {[...trustedBrands, ...trustedBrands, ...trustedBrands].map((brand, index) => (
                <div
                  key={`${brand}-${index}`}
                  className="group inline-flex px-8 py-4 bg-white/60 backdrop-blur-md border border-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-default hover:scale-105"
                  style={{
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(241, 173, 50, 0.2), 0 10px 10px -5px rgba(37, 99, 235, 0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                  }}
                >
                  <span className="text-xl font-bold text-gray-800 whitespace-nowrap">
                    {brand}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Optional: Trust indicators */}
        <div className="mt-12 flex flex-wrap justify-center items-center gap-8 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>+500 clientes activos</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>10+ años de experiencia</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span>100% cumplimiento normativo</span>
          </div>
        </div>
      </div>

      {/* CSS for marquee animation */}
      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.333%);
          }
        }

        .animate-marquee {
          animation: marquee 40s linear infinite;
        }

        .animate-marquee:hover {
          animation-play-state: paused;
        }

        /* Respect reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .animate-marquee {
            animation: none;
          }
        }
      `}</style>
    </section>
  )
}
