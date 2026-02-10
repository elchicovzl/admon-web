"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { User, Quote } from "lucide-react"

interface Testimonial {
  quote: string
  name: string
  role?: string
}

const testimonials: Testimonial[] = [
  {
    quote:
      "Excelente servicio de afiliaciones a la seguridad social. Nos ayudaron con todas las EPS, ARL y fondos de pensión de manera muy eficiente. Altamente recomendado para empresas.",
    name: "María González",
    role: "Directora de RH",
  },
  {
    quote:
      "Los servicios de liquidación PILA han sido fundamentales para nuestro negocio. Manejan todas las planillas sin errores y siempre a tiempo. Un alivio tener profesionales confiables.",
    name: "Carlos Rodríguez",
    role: "Gerente General",
  },
  {
    quote:
      "El servicio de recobro de incapacidades nos ha ahorrado tiempo y dinero. Su equipo conoce perfectamente el proceso ante EPS y ARL. Excelente atención y resultados.",
    name: "Ana Martínez",
    role: "Contadora",
  },
]

export default function TestimonialSlider() {
  const [currentIndex, setCurrentIndex] = useState(0)

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
  }

  const getVisibleTestimonials = () => {
    const prevIndex = currentIndex === 0 ? testimonials.length - 1 : currentIndex - 1
    const nextIndex = currentIndex === testimonials.length - 1 ? 0 : currentIndex + 1

    return {
      prev: testimonials[prevIndex],
      current: testimonials[currentIndex],
      next: testimonials[nextIndex]
    }
  }

  const { prev, current, next } = getVisibleTestimonials()

  return (
    <div className="relative w-full px-4">
      {/* Slider container */}
      <div className="relative h-auto flex items-center justify-center py-8">
        
       
        {/* Fixed position containers for each card */}
        <div className="flex items-center justify-center w-full relative">

          {/* Previous card (left, fixed position) - hidden on mobile */}
          <div className="absolute left-8 w-96 transform transition-all duration-700 ease-in-out opacity-50 scale-95 hidden md:block">
            <div className="group p-6 rounded-2xl bg-white border border-gray-200 shadow-xl hover:shadow-2xl transition-all duration-300 h-64 flex flex-col justify-between">
              {/* Quote icon */}
              <Quote className="w-8 h-8 text-gray-400 mb-2" />

              <p className="text-sm font-medium text-gray-700 leading-relaxed line-clamp-3">
                "{prev.quote}"
              </p>

              <div className="flex items-center mt-4">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-200 to-blue-200 rounded-full flex items-center justify-center mr-3 shadow-md">
                  <User className="w-5 h-5 text-gray-700" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{prev.name}</p>
                  {prev.role && <p className="text-xs text-gray-600">{prev.role}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Current card (center, fixed position) */}
          <div className="w-full max-w-[700px] px-4 md:px-0 md:w-[700px] transform transition-all duration-700 ease-in-out opacity-100 scale-100 z-10">
            <div className="group p-8 md:p-10 rounded-3xl bg-white border border-gray-200 shadow-2xl hover:shadow-3xl transition-all duration-300 min-h-[280px] flex flex-col justify-between" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)' }}>
              {/* Quote icon */}
              <Quote className="w-12 h-12 text-orange-500 mb-4" />

              <p className="text-lg md:text-xl font-medium text-gray-800 leading-relaxed text-center">
                "{current.quote}"
              </p>

              <div className="flex items-center justify-center mt-6">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-blue-400 rounded-full flex items-center justify-center mr-4 shadow-lg">
                  <User className="w-7 h-7 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-900 text-lg">{current.name}</p>
                  {current.role && <p className="text-sm text-gray-600">{current.role}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Next card (right, fixed position) - hidden on mobile */}
          <div className="absolute right-8 w-96 transform transition-all duration-700 ease-in-out opacity-50 scale-95 hidden md:block">
            <div className="group p-6 rounded-2xl bg-white border border-gray-200 shadow-xl hover:shadow-2xl transition-all duration-300 h-64 flex flex-col justify-between">
              {/* Quote icon */}
              <Quote className="w-8 h-8 text-gray-400 mb-2" />

              <p className="text-sm font-medium text-gray-700 leading-relaxed line-clamp-3">
                "{next.quote}"
              </p>

              <div className="flex items-center mt-4">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-200 to-blue-200 rounded-full flex items-center justify-center mr-3 shadow-md">
                  <User className="w-5 h-5 text-gray-700" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{next.name}</p>
                  {next.role && <p className="text-xs text-gray-600">{next.role}</p>}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Navigation dots */}
      <div className="flex justify-center space-x-3 mt-8">
        {testimonials.map((_, index) => (
          <button
            key={index}
            className={cn(
              "w-3 h-3 rounded-full transition-all duration-300 hover:scale-125",
              index === currentIndex
                ? "bg-gradient-to-r from-orange-500 to-blue-600 scale-110"
                : "bg-gray-300 hover:bg-gray-400",
            )}
            onClick={() => goToSlide(index)}
            aria-label={`Go to testimonial ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
