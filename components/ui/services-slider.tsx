"use client"

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ShieldPlus, TrendUp, HardHat, HandHeart, Handshake } from '@phosphor-icons/react'

export interface ServiceCard {
  title: string
  description: string
  id: number
  icon: React.ReactNode
  accentColor: string
  bgGradient: string
}

const SERVICES: ServiceCard[] = [
  {
    title: 'EPS (Salud)',
    description: 'Afiliación a entidades promotoras de salud para trabajadores y sus familias.',
    id: 1,
    icon: <ShieldPlus size={64} weight="bold" />,
    accentColor: 'text-blue-400',
    bgGradient: 'from-blue-500/10 to-blue-600/5'
  },
  {
    title: 'Pensión',
    description: 'Gestión de afiliaciones a fondos de pensiones obligatorias y voluntarias.',
    id: 2,
    icon: <TrendUp size={64} weight="bold" />,
    accentColor: 'text-emerald-400',
    bgGradient: 'from-emerald-500/10 to-emerald-600/5'
  },
  {
    title: 'ARL (Riesgos Laborales)',
    description: 'Protección integral contra accidentes laborales y enfermedades profesionales.',
    id: 3,
    icon: <HardHat size={64} weight="fill" />,
    accentColor: 'text-orange-400',
    bgGradient: 'from-orange-500/10 to-orange-600/5'
  },
  {
    title: 'Caja de Compensación',
    description: 'Servicios de bienestar, subsidios y beneficios para trabajadores y familias.',
    id: 4,
    icon: <HandHeart size={64} weight="fill" />,
    accentColor: 'text-purple-400',
    bgGradient: 'from-purple-500/10 to-purple-600/5'
  },
  {
    title: 'Asesoría Integral',
    description: 'Acompañamiento completo en seguridad social y gestión de nómina.',
    id: 5,
    icon: <Handshake size={64} weight="bold" />,
    accentColor: 'text-pink-400',
    bgGradient: 'from-pink-500/10 to-pink-600/5'
  }
]

const AUTO_SCROLL_DELAY = 5000

export default function ServicesSlider() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(0)

  // Auto-scroll functionality
  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1)
      setCurrentIndex((prev) => (prev + 1) % SERVICES.length)
    }, AUTO_SCROLL_DELAY)
    return () => clearInterval(timer)
  }, [])

  const currentService = SERVICES[currentIndex]

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.8
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.8
    })
  }

  const swipeConfidenceThreshold = 10000
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity
  }

  const paginate = (newDirection: number) => {
    setDirection(newDirection)
    setCurrentIndex((prev) => {
      const nextIndex = prev + newDirection
      if (nextIndex < 0) return SERVICES.length - 1
      if (nextIndex >= SERVICES.length) return 0
      return nextIndex
    })
  }

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Main Card */}
      <div className="relative w-full aspect-square overflow-hidden">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.3 },
              scale: { duration: 0.3 }
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = swipePower(offset.x, velocity.x)
              if (swipe < -swipeConfidenceThreshold) {
                paginate(1)
              } else if (swipe > swipeConfidenceThreshold) {
                paginate(-1)
              }
            }}
            className="absolute inset-0"
          >
            <div className="h-full w-full relative rounded-full overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl hover:shadow-[0_0_40px_rgba(255,255,255,0.1)] transition-shadow duration-300 cursor-grab active:cursor-grabbing">
              {/* Accent gradient background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${currentService.bgGradient} opacity-50`} />

              {/* Content */}
              <div className="relative h-full p-10 flex flex-col justify-center items-center text-center">
                {/* Icon */}
                <div className={`mb-6 ${currentService.accentColor}`}>
                  {currentService.icon}
                </div>

                {/* Title */}
                <h3 className="text-3xl font-bold text-white mb-4 leading-tight">
                  {currentService.title}
                </h3>

                {/* Description */}
                <p className="text-lg text-white/80 leading-relaxed max-w-xs">
                  {currentService.description}
                </p>
              </div>

              {/* Decorative corner accent */}
              <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br ${currentService.bgGradient} blur-3xl opacity-30`} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pagination Dots */}
      <div className="flex justify-center gap-2 mt-8">
        {SERVICES.map((service, index) => (
          <button
            key={service.id}
            onClick={() => {
              setDirection(index > currentIndex ? 1 : -1)
              setCurrentIndex(index)
            }}
            aria-label={`Go to ${service.title}`}
            className="group focus:outline-none"
          >
            <div className={`h-2 rounded-full transition-all duration-300 ${
              currentIndex === index
                ? 'bg-white w-12'
                : 'bg-white/30 w-2 group-hover:bg-white/50 group-hover:w-6'
            }`} />
          </button>
        ))}
      </div>
    </div>
  )
}
