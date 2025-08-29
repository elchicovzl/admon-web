"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { User } from "lucide-react"

interface Testimonial {
  quote: string
  name: string
  bgColor: string
}

const testimonials: Testimonial[] = [
  {
    quote:
      "Excelente servicio de afiliaciones a la seguridad social. Nos ayudaron con todas las EPS, ARL y fondos de pensión de manera muy eficiente. Altamente recomendado para empresas.",
    name: "María González",
    bgColor: "bg-blue-100",
  },
  {
    quote:
      "Los servicios de liquidación PILA han sido fundamentales para nuestro negocio. Manejan todas las planillas sin errores y siempre a tiempo. Un alivio tener profesionales confiables.",
    name: "Carlos Rodríguez",
    bgColor: "bg-green-100",
  },
  {
    quote:
      "El servicio de recobro de incapacidades nos ha ahorrado tiempo y dinero. Su equipo conoce perfectamente el proceso ante EPS y ARL. Excelente atención y resultados.",
    name: "Ana Martínez",
    bgColor: "bg-purple-100",
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
    <div className="relative w-full overflow-hidden">
      {/* Slider container - full width */}
      <div className="relative h-64 md:h-64 flex items-center justify-center">
        {/* Left gradient overlay - hidden on mobile */}
        <div className="absolute left-0 top-0 w-40 h-full bg-gradient-to-r from-white via-white/90 to-transparent z-10 pointer-events-none hidden md:block" />
        
        {/* Right gradient overlay - hidden on mobile */}
        <div className="absolute right-0 top-0 w-40 h-full bg-gradient-to-l from-white via-white/90 to-transparent z-10 pointer-events-none hidden md:block" />

        {/* Fixed position containers for each card */}
        <div className="flex items-center justify-center w-full relative">
          
          {/* Previous card (left, fixed position) - hidden on mobile */}
          <div className="absolute left-8 w-80 transform transition-all duration-700 ease-in-out opacity-40 scale-95 hidden md:block">
            <div className={cn(
              "p-6 rounded-2xl shadow-sm h-48 flex flex-col justify-between transition-colors duration-700 ease-in-out",
              prev.bgColor
            )}>
              <p className="text-base font-medium text-gray-800 leading-relaxed line-clamp-3">
                "{prev.quote}"
              </p>
              <div className="flex items-center mt-3">
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
                <p className="font-medium text-gray-900 text-sm">{prev.name}</p>
              </div>
            </div>
          </div>

          {/* Current card (center, fixed position) */}
          <div className="w-full max-w-[600px] px-4 md:px-0 md:w-[600px] transform transition-all duration-700 ease-in-out opacity-100 scale-100 z-10">
            <div className={cn(
              "p-6 md:p-8 rounded-2xl shadow-lg h-auto md:h-48 flex flex-col justify-between transition-colors duration-700 ease-in-out",
              current.bgColor
            )}>
              <p className="text-base md:text-md font-medium text-gray-800 leading-relaxed text-center">
                "{current.quote}"
              </p>
              <div className="flex items-center justify-center mt-4">
                <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                  <User className="w-5 h-5 text-gray-600" />
                </div>
                <p className="font-semibold text-gray-900">{current.name}</p>
              </div>
            </div>
          </div>

          {/* Next card (right, fixed position) - hidden on mobile */}
          <div className="absolute right-8 w-80 transform transition-all duration-700 ease-in-out opacity-40 scale-95 hidden md:block">
            <div className={cn(
              "p-6 rounded-2xl shadow-sm h-48 flex flex-col justify-between transition-colors duration-700 ease-in-out",
              next.bgColor
            )}>
              <p className="text-base font-medium text-gray-800 leading-relaxed line-clamp-3">
                "{next.quote}"
              </p>
              <div className="flex items-center mt-3">
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
                <p className="font-medium text-gray-900 text-sm">{next.name}</p>
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
              "w-3 h-3 rounded-full transition-all duration-300 hover:scale-110",
              index === currentIndex 
                ? "bg-gray-800" 
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