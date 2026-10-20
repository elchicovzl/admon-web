"use client"

import { useEffect, useRef, useState } from "react"
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type Variants,
} from "motion/react"
import { Handshake, Scale, Users2, Zap, type LucideIcon } from "lucide-react"

interface Value {
  name: string
  description: string
  icon: LucideIcon
  // Bento placement and visual weight.
  className: string
  featured?: boolean
  wide?: boolean
}

const values: Value[] = [
  {
    name: "Confianza",
    description: "Base fundamental de nuestras relaciones comerciales",
    icon: Handshake,
    className: "sm:col-span-2 lg:row-span-2",
    featured: true,
  },
  {
    name: "Eficiencia",
    description: "Optimización de procesos para mejores resultados",
    icon: Zap,
    className: "sm:col-span-2",
    wide: true,
  },
  {
    name: "Responsabilidad",
    description: "Compromiso total con nuestros clientes",
    icon: Users2,
    className: "",
  },
  {
    name: "Integridad",
    description: "Transparencia en cada una de nuestras acciones",
    icon: Scale,
    className: "",
  },
]

// Max tilt in degrees, parallax travel in px (desktop), and mobile multiplier.
const MAX_TILT = 8
const NUMERAL_TRAVEL = 24
const MOBILE_AMPLITUDE = 0.3
const SPRING = { stiffness: 220, damping: 22, mass: 0.6 }

function ValueTile({ value, index }: { value: Value; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { featured, wide } = value

  // Both start false/mobile so server and first client render agree.
  const [canTilt, setCanTilt] = useState(false)
  const amplitude = useMotionValue(MOBILE_AMPLITUDE)

  useEffect(() => {
    const hover = window.matchMedia("(hover: hover) and (pointer: fine)")
    const desktop = window.matchMedia("(min-width: 1024px)")
    const sync = () => {
      setCanTilt(hover.matches)
      amplitude.set(desktop.matches ? 1 : MOBILE_AMPLITUDE)
    }
    sync()
    hover.addEventListener("change", sync)
    desktop.addEventListener("change", sync)
    return () => {
      hover.removeEventListener("change", sync)
      desktop.removeEventListener("change", sync)
    }
  }, [amplitude])

  // Pointer position inside the tile, normalized to -0.5..0.5.
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const active = useMotionValue(0)
  const sx = useSpring(px, SPRING)
  const sy = useSpring(py, SPRING)
  const sActive = useSpring(active, { stiffness: 160, damping: 24 })

  const rotateX = useTransform(sy, [-0.5, 0.5], [MAX_TILT, -MAX_TILT])
  const rotateY = useTransform(sx, [-0.5, 0.5], [-MAX_TILT, MAX_TILT])

  // Spotlight follows the raw pointer for a tighter feel.
  const spotX = useTransform(px, (v) => `${(v + 0.5) * 100}%`)
  const spotY = useTransform(py, (v) => `${(v + 0.5) * 100}%`)
  const spotColor = featured ? "rgba(224,160,37,0.28)" : "rgba(224,160,37,0.20)"
  const spotlight = useMotionTemplate`radial-gradient(420px circle at ${spotX} ${spotY}, ${spotColor}, transparent 65%)`

  const tiltEnabled = canTilt && !reduceMotion

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!tiltEnabled || e.pointerType !== "mouse") return
    const rect = e.currentTarget.getBoundingClientRect()
    px.set((e.clientX - rect.left) / rect.width - 0.5)
    py.set((e.clientY - rect.top) / rect.height - 0.5)
    active.set(1)
  }

  const handleLeave = () => {
    px.set(0)
    py.set(0)
    active.set(0)
  }

  // Background numeral drifts slowly against scroll.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const numeralY = useTransform(
    () => (1 - scrollYProgress.get() * 2) * -NUMERAL_TRAVEL * amplitude.get(),
  )

  const variants: Variants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 32 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut", delay: index * 0.12 },
    },
  }

  const Icon = value.icon
  const number = String(index + 1).padStart(2, "0")

  return (
    <motion.div
      ref={ref}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      className={value.className}
    >
      <motion.div
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        style={tiltEnabled ? { rotateX, rotateY, transformPerspective: 900 } : undefined}
        className={`group relative h-full min-h-[13rem] overflow-hidden rounded-3xl p-7 will-change-transform ${
          featured
            ? "bg-gradient-to-br from-brand-navy to-brand-navy-deep text-white shadow-xl lg:min-h-[28rem] lg:p-10"
            : "border border-brand-gold/25 bg-white text-brand-navy shadow-sm transition-colors duration-300 hover:border-brand-gold/60 lg:p-8"
        }`}
      >
        {featured && (
          <>
            {/* Decorative concentric rings + glow */}
            <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-gold/20 blur-3xl" />
            {[14, 20, 26].map((size) => (
              <div
                key={size}
                aria-hidden
                style={{ width: `${size}rem`, height: `${size}rem` }}
                className="pointer-events-none absolute -right-16 -top-16 rounded-full border border-brand-gold/20 lg:-right-20 lg:-top-20"
              />
            ))}
          </>
        )}

        {/* Background numeral */}
        <motion.span
          aria-hidden
          style={reduceMotion ? undefined : { y: numeralY }}
          className={`pointer-events-none absolute -bottom-8 -right-1 select-none font-figtree font-black leading-none ${
            featured ? "text-[11rem] text-white/5 lg:text-[16rem]" : "text-[8rem] text-brand-navy/5 lg:text-[9rem]"
          }`}
        >
          {number}
        </motion.span>

        {/* Gold spotlight following the pointer */}
        {tiltEnabled && (
          <motion.div
            aria-hidden
            style={{ background: spotlight, opacity: sActive }}
            className="pointer-events-none absolute inset-0"
          />
        )}

        <div className={`relative z-10 flex h-full flex-col ${featured ? "justify-between gap-12" : "gap-5"}`}>
          <Icon
            strokeWidth={1.5}
            className={`text-brand-gold ${featured ? "h-14 w-14 lg:h-16 lg:w-16" : "h-10 w-10"}`}
          />
          <div className={wide ? "max-w-md" : ""}>
            <h3
              className={`mb-2 font-figtree font-bold ${
                featured ? "text-3xl lg:text-4xl" : "text-xl lg:text-2xl"
              }`}
            >
              {value.name}
            </h3>
            <p
              className={`leading-relaxed ${
                featured ? "max-w-sm text-lg text-white/80" : "text-sm text-gray-600 lg:text-base"
              }`}
            >
              {value.description}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function ValuesBento() {
  const reduceMotion = useReducedMotion()

  const headerVariants: Variants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  }

  return (
    <div>
      <motion.div
        variants={headerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="mb-10 lg:mb-14 grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-end lg:gap-16"
      >
        <div>
          <p className="mb-3 flex items-center gap-3 text-xs font-bold tracking-[0.2em] text-brand-gold before:h-px before:w-8 before:bg-brand-gold">
            03
          </p>
          <h2 className="text-3xl lg:text-4xl font-figtree font-bold text-brand-navy">Valores</h2>
        </div>
        <p className="text-gray-700 leading-relaxed text-lg">
          En ADMINISTRACIÓN SEGURA, entendemos que la confianza es la base de cada relación. Por eso, nuestros
          procesos y la manera en que nos conectamos con nuestros clientes están guiados por una serie de valores
          fundamentales que definen quiénes somos y cómo trabajamos.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {values.map((value, index) => (
          <ValueTile key={value.name} value={value} index={index} />
        ))}
      </div>
    </div>
  )
}
