"use client"

import { useEffect, useState, useRef } from 'react'
import { motion, PanInfo, useMotionValue, useTransform } from 'motion/react'
import React from 'react'
import { Hospital, PiggyBank, HardHat, Home, Users2 } from 'lucide-react'

export interface CarouselItem {
  title: string
  description: string
  id: number
  icon: React.ReactNode
  image?: string
}

export interface CarouselProps {
  items?: CarouselItem[]
  baseWidth?: number
  autoplay?: boolean
  autoplayDelay?: number
  pauseOnHover?: boolean
  loop?: boolean
  round?: boolean
}

const DEFAULT_ITEMS: CarouselItem[] = [
  {
    title: 'EPS (Salud)',
    description: 'Afiliación a entidades promotoras de salud para trabajadores.',
    id: 1,
    icon: <Hospital className="h-[16px] w-[16px] text-white" />,
    image: '/images/slider/eps.png'
  },
  {
    title: 'Pensión',
    description: 'Gestión de afiliaciones a fondos de pensiones obligatorias.',
    id: 2,
    icon: <PiggyBank className="h-[16px] w-[16px] text-white" />,
    image: '/images/slider/pension.png'
  },
  {
    title: 'ARL (Riesgos Laborales)',
    description: 'Protección contra accidentes laborales y enfermedades profesionales.',
    id: 3,
    icon: <HardHat className="h-[16px] w-[16px] text-white" />,
    image: '/images/slider/arl.png'
  },
  {
    title: 'Caja de Compensación',
    description: 'Servicios de bienestar y subsidios para trabajadores y familias.',
    id: 4,
    icon: <Home className="h-[16px] w-[16px] text-white" />,
    image: '/images/slider/caja.png'
  },
  {
    title: 'Asesoría Integral',
    description: 'Acompañamiento completo en seguridad social para empresas.',
    id: 5,
    icon: <Users2 className="h-[16px] w-[16px] text-white" />,
    image: '/images/slider/asesoria.png'
  }
]

const DRAG_BUFFER = 0
const VELOCITY_THRESHOLD = 500
const GAP = 16
const SPRING_OPTIONS = { type: 'spring', stiffness: 300, damping: 30 } as const

export default function MotionCarousel({
  items = DEFAULT_ITEMS,
  baseWidth = 300,
  autoplay = false,
  autoplayDelay = 3000,
  pauseOnHover = false,
  loop = false,
  round = false
}: CarouselProps) {
  const containerPadding = 16
  const itemWidth = baseWidth - containerPadding * 2
  const trackItemOffset = itemWidth + GAP

  const carouselItems = loop ? [...items, items[0]] : items
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const x = useMotionValue(0)
  const [isHovered, setIsHovered] = useState<boolean>(false)
  const [isResetting, setIsResetting] = useState<boolean>(false)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (pauseOnHover && containerRef.current) {
      const container = containerRef.current
      const handleMouseEnter = () => setIsHovered(true)
      const handleMouseLeave = () => setIsHovered(false)
      container.addEventListener('mouseenter', handleMouseEnter)
      container.addEventListener('mouseleave', handleMouseLeave)
      return () => {
        container.removeEventListener('mouseenter', handleMouseEnter)
        container.removeEventListener('mouseleave', handleMouseLeave)
      }
    }
  }, [pauseOnHover])

  useEffect(() => {
    if (autoplay && (!pauseOnHover || !isHovered)) {
      const timer = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev === items.length - 1 && loop) {
            return prev + 1
          }
          if (prev === carouselItems.length - 1) {
            return loop ? 0 : prev
          }
          return prev + 1
        })
      }, autoplayDelay)
      return () => clearInterval(timer)
    }
  }, [autoplay, autoplayDelay, isHovered, loop, items.length, carouselItems.length, pauseOnHover])

  const effectiveTransition = isResetting ? { duration: 0 } : SPRING_OPTIONS

  const handleAnimationComplete = () => {
    if (loop && currentIndex === carouselItems.length - 1) {
      setIsResetting(true)
      x.set(0)
      setCurrentIndex(0)
      setTimeout(() => setIsResetting(false), 50)
    }
  }

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo): void => {
    const offset = info.offset.x
    const velocity = info.velocity.x
    if (offset < -DRAG_BUFFER || velocity < -VELOCITY_THRESHOLD) {
      if (loop && currentIndex === items.length - 1) {
        setCurrentIndex(currentIndex + 1)
      } else {
        setCurrentIndex(prev => Math.min(prev + 1, carouselItems.length - 1))
      }
    } else if (offset > DRAG_BUFFER || velocity > VELOCITY_THRESHOLD) {
      if (loop && currentIndex === 0) {
        setCurrentIndex(items.length - 1)
      } else {
        setCurrentIndex(prev => Math.max(prev - 1, 0))
      }
    }
  }

  const dragProps = loop
    ? {}
    : {
      dragConstraints: {
        left: -trackItemOffset * (carouselItems.length - 1),
        right: 0
      }
    }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden p-4 ${round ? 'rounded-full border border-white/10 bg-white/5 backdrop-blur-sm' : 'rounded-[24px] border border-border'
        }`}
      style={{
        width: `${baseWidth}px`,
        ...(round && { height: `${baseWidth}px` })
      }}
    >
      <motion.div
        className="flex"
        drag="x"
        {...dragProps}
        style={{
          width: itemWidth,
          gap: `${GAP}px`,
          perspective: 1000,
          perspectiveOrigin: `${currentIndex * trackItemOffset + itemWidth / 2}px 50%`,
          x
        }}
        onDragEnd={handleDragEnd}
        animate={{ x: -(currentIndex * trackItemOffset) }}
        transition={effectiveTransition}
        onAnimationComplete={handleAnimationComplete}
      >
        {carouselItems.map((item, index) => {
          const range = [-(index + 1) * trackItemOffset, -index * trackItemOffset, -(index - 1) * trackItemOffset]
          const outputRange = [90, 0, -90]
          const rotateY = useTransform(x, range, outputRange, { clamp: false })
          return (
            <motion.div
              key={index}
              className={`relative shrink-0 flex flex-col ${round
                ? 'items-center justify-center text-center bg-slate-900/50 backdrop-blur-md border border-white/10'
                : 'items-start justify-between bg-card border border-border rounded-[12px]'
                } overflow-hidden cursor-grab active:cursor-grabbing`}
              style={{
                width: itemWidth,
                height: round ? itemWidth : '100%',
                rotateY: rotateY,
                ...(round && { borderRadius: '50%' })
              }}
              transition={effectiveTransition}
            >
              {round && item.image ? (
                <>
                  <div className="absolute inset-0 z-0">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50" />
                  </div>
                  <div className="relative z-10 flex flex-col items-center justify-center p-6 h-full text-white">
                    <div className="mb-4 p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
                      {/* Clone icon with distinct color if needed, or just render. The icon is ReactNode, usually generic. 
                            The original code used a wrapper with bg-primary. Here we use glassmorphism.
                        */}
                      {React.isValidElement(item.icon) ? React.cloneElement(item.icon, { className: "h-6 w-6 text-white" } as any) : item.icon}
                    </div>
                    <div className="mb-2 font-black text-xl text-white tracking-tight">{item.title}</div>
                    <p className="text-sm font-medium text-white/90 leading-relaxed max-w-[200px] mx-auto">{item.description}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className={`${round ? 'p-0 m-0' : 'mb-4 p-0'}`}>
                    {item.image ? (
                      <div className="w-full h-40 relative rounded-t-[12px] overflow-hidden mb-4">
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="p-5">
                        <span className="flex h-[28px] w-[28px] items-center justify-center rounded-full bg-primary">
                          {item.icon}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="mb-1 font-black text-lg text-primary-foreground">{item.title}</div>
                    <p className="text-sm text-primary-foreground/80">{item.description}</p>
                  </div>
                </>
              )}
            </motion.div>
          )
        })}
      </motion.div>
      <div className={`flex w-full justify-center ${round ? 'absolute z-20 bottom-12 left-1/2 -translate-x-1/2' : ''}`}>
        <div className="mt-4 flex w-[150px] justify-between px-8">
          {items.map((_, index) => (
            <motion.div
              key={index}
              className={`h-2 w-2 rounded-full cursor-pointer transition-colors duration-150 ${currentIndex % items.length === index
                ? round
                  ? 'bg-white'
                  : 'bg-primary'
                : round
                  ? 'bg-muted-foreground/40'
                  : 'bg-muted-foreground/40'
                }`}
              animate={{
                scale: currentIndex % items.length === index ? 1.2 : 1
              }}
              onClick={() => setCurrentIndex(index)}
              transition={{ duration: 0.15 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}