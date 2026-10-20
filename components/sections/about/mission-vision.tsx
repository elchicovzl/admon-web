"use client"

import { useEffect, useRef } from "react"
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from "motion/react"
import { Award, CheckCircle, HardHat, Home, Hospital, PiggyBank, Target } from "lucide-react"

const missionItems = [
  { icon: Hospital, text: "Salud" },
  { icon: PiggyBank, text: "Pensión" },
  { icon: HardHat, text: "Riesgos laborales" },
  { icon: Home, text: "Caja de compensación familiar" },
]

const visionItems = [
  { icon: Award, text: "Liderazgo Regional" },
  { icon: Target, text: "Procesos Ágiles" },
  { icon: CheckCircle, text: "Transparencia Legal" },
]

// Parallax travel in px (start -> end of the scroll range) on desktop.
const MISSION_TRAVEL = 40
const VISION_TRAVEL = 80
const NUMERAL_TRAVEL = 30
// Multiplier applied below the lg breakpoint to keep motion subtle.
const MOBILE_AMPLITUDE = 0.3

export function MissionVision() {
  const ref = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  // Starts at the mobile amplitude so server and first client render agree.
  const amplitude = useMotionValue(MOBILE_AMPLITUDE)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const sync = () => amplitude.set(mq.matches ? 1 : MOBILE_AMPLITUDE)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [amplitude])

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })

  // Maps scroll progress (0..1) to travel -> -travel, scaled by amplitude.
  const parallax = (travel: number) =>
    useTransform(() => (1 - scrollYProgress.get() * 2) * travel * amplitude.get())

  const missionY = parallax(MISSION_TRAVEL)
  const visionY = parallax(VISION_TRAVEL)
  // Deeper layer: moves the opposite way and slower than the panels.
  const numeralY = parallax(-NUMERAL_TRAVEL)

  const panelVariants: Variants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 32 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: "easeOut", staggerChildren: 0.1, delayChildren: 0.25 },
    },
  }

  const itemVariants: Variants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  }

  const reveal = {
    initial: "hidden",
    whileInView: "show",
    viewport: { once: true, margin: "-80px" },
    variants: panelVariants,
  } as const

  return (
    <div ref={ref} className="grid lg:grid-cols-2 gap-6 lg:gap-8 mb-20">
      {/* Mission - dark panel */}
      <motion.div style={reduceMotion ? undefined : { y: missionY }}>
        <motion.div
          {...reveal}
          className="relative h-full overflow-hidden rounded-3xl bg-gradient-to-br from-brand-navy to-brand-navy-deep p-8 lg:p-12 text-white shadow-xl"
        >
          {/* Texture: subtle grid + gold glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-gold/25 blur-3xl"
          />
          <motion.span
            aria-hidden
            style={reduceMotion ? undefined : { y: numeralY }}
            className="pointer-events-none absolute -bottom-10 -right-2 select-none font-figtree text-[11rem] lg:text-[16rem] font-black leading-none text-white/5"
          >
            01
          </motion.span>

          <div className="relative z-10">
            <motion.p
              variants={itemVariants}
              className="mb-3 flex items-center gap-3 text-xs font-bold tracking-[0.2em] text-brand-gold before:h-px before:w-8 before:bg-brand-gold"
            >
              01
            </motion.p>
            <motion.h2
              variants={itemVariants}
              className="mb-6 text-3xl lg:text-4xl font-figtree font-bold text-balance"
            >
              Nuestra Misión
            </motion.h2>
            <motion.p variants={itemVariants} className="mb-10 text-lg leading-relaxed text-white/80">
              Brindar acompañamiento integral en la afiliación a la Seguridad Social y servicios complementarios,
              creando alianzas estratégicas que garanticen tarifas competitivas y un servicio ágil mediante la
              optimización de procesos y el uso de tecnología.
            </motion.p>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {missionItems.map((item) => (
                <motion.li
                  key={item.text}
                  variants={itemVariants}
                  whileHover={reduceMotion ? undefined : { y: -4 }}
                  className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur transition-colors duration-300 hover:border-brand-gold/50 hover:bg-white/15"
                >
                  <item.icon className="h-5 w-5 shrink-0 text-brand-gold" />
                  <span className="text-sm font-semibold leading-tight text-white">{item.text}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>
      </motion.div>

      {/* Vision - light panel with gold gradient border */}
      <motion.div style={reduceMotion ? undefined : { y: visionY }}>
        <motion.div
          {...reveal}
          className="h-full rounded-3xl bg-gradient-to-br from-brand-gold via-brand-gold/30 to-brand-gold p-px shadow-sm"
        >
          <div className="relative h-full overflow-hidden rounded-[calc(1.5rem-1px)] bg-white p-8 lg:p-12 text-brand-navy">
            <motion.span
              aria-hidden
              style={reduceMotion ? undefined : { y: numeralY }}
              className="pointer-events-none absolute -bottom-10 -right-2 select-none font-figtree text-[11rem] lg:text-[16rem] font-black leading-none text-brand-navy/5"
            >
              02
            </motion.span>

            <div className="relative z-10">
              <motion.p
                variants={itemVariants}
                className="mb-3 flex items-center gap-3 text-xs font-bold tracking-[0.2em] text-brand-gold before:h-px before:w-8 before:bg-brand-gold"
              >
                02
              </motion.p>
              <motion.h2
                variants={itemVariants}
                className="mb-6 text-3xl lg:text-4xl font-figtree font-bold text-balance"
              >
                Visión
              </motion.h2>
              <motion.p variants={itemVariants} className="mb-10 text-lg leading-relaxed text-gray-700">
                Ser una empresa reconocida a nivel regional y lograr la confianza y credibilidad de empresas e
                independientes en el sector de la seguridad social mediante procesos ágiles, manejo transparente de los
                recursos dentro del marco legal.
              </motion.p>

              {/* Timeline: vertical gold line with a dot per step */}
              <ol className="relative space-y-6">
                <span
                  aria-hidden
                  className="absolute bottom-3 left-[7px] top-3 w-px bg-gradient-to-b from-brand-gold via-brand-gold/60 to-brand-gold/10"
                />
                {visionItems.map((item) => (
                  <motion.li
                    key={item.text}
                    variants={itemVariants}
                    className="group/step relative flex items-center gap-5"
                  >
                    <span className="relative z-10 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-brand-gold bg-white transition-all duration-300 group-hover/step:bg-brand-gold group-hover/step:shadow-[0_0_0_6px_rgba(224,160,37,0.2),0_0_16px_rgba(224,160,37,0.7)]" />
                    <item.icon className="h-5 w-5 shrink-0 text-brand-gold" />
                    <span className="text-base font-bold">{item.text}</span>
                  </motion.li>
                ))}
              </ol>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
