'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react'
import { features } from '@/data/features'
import { StatCard } from './stat-card'

// Parallax travel in px across the whole story.
const IMAGE_TRAVEL = 20
const CARD_TRAVEL = 40

// Card placement over the frame, per feature (matches the original layout intent).
const CARD_POSITION = [
  'bottom-8 -right-4 xl:-right-8',
  'top-8 -right-4 xl:-right-8',
  'top-8 -left-4 xl:-left-8',
]

const pad = (n: number) => String(n).padStart(2, '0')

/** Desktop sticky scroll story: text steps on the left, pinned visual on the right. */
export function BenefitsStory() {
  const reduceMotion = useReducedMotion()
  const stepsRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  // 0 when the steps' top reaches viewport center, 1 when the bottom does.
  const { scrollYProgress } = useScroll({
    target: stepsRef,
    offset: ['start center', 'end center'],
  })

  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const next = Math.min(features.length - 1, Math.max(0, Math.floor(p * features.length)))
    setActive((prev) => (prev === next ? prev : next))
  })

  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 })
  const progress = reduceMotion ? scrollYProgress : smooth

  const imageY = useTransform(scrollYProgress, [0, 1], [IMAGE_TRAVEL, -IMAGE_TRAVEL])
  const cardY = useTransform(scrollYProgress, [0, 1], [CARD_TRAVEL, -CARD_TRAVEL])

  const feature = features[active]

  return (
    <div className="grid grid-cols-2 gap-16 xl:gap-24">
      {/* Text column */}
      <div ref={stepsRef} className="relative pl-8">
        {/* Progress track + gold fill */}
        <div aria-hidden className="absolute bottom-0 left-0 top-0 w-px bg-brand-navy/10">
          <motion.div
            style={{ scaleY: progress }}
            className="h-full w-full origin-top bg-brand-gold"
          />
        </div>

        {features.map((item, index) => {
          const isActive = index === active
          return (
            <motion.article
              key={item.id}
              animate={{ opacity: isActive ? 1 : 0.4 }}
              transition={{ duration: reduceMotion ? 0 : 0.4 }}
              className="relative flex min-h-[80vh] flex-col justify-center py-10"
            >
              <span
                aria-hidden
                className={`absolute -left-[calc(2rem+1px)] top-1/2 h-24 w-[3px] -translate-y-1/2 rounded-full bg-brand-gold transition-opacity duration-300 ${
                  isActive ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <span aria-hidden className="mb-4 text-sm font-bold tracking-[0.2em] text-brand-gold">
                {pad(index + 1)}
              </span>
              <h3 className="mb-4 font-figtree text-3xl font-bold leading-tight text-brand-navy xl:text-4xl">
                {item.title}
              </h3>
              <p className="max-w-lg text-lg leading-relaxed text-gray-600">{item.description}</p>
              {item.stats && (
                <p className="mt-6 flex items-baseline gap-3">
                  <span className="font-figtree text-3xl font-bold text-brand-navy">
                    {item.stats.value}
                  </span>
                  <span className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    {item.stats.label}
                  </span>
                </p>
              )}
            </motion.article>
          )
        })}
      </div>

      {/* Pinned visual column */}
      <div>
        <div className="sticky top-24 flex h-[calc(100vh-8rem)] flex-col items-center justify-center">
          <div className="relative w-full max-w-xl">
            {/* Soft navy/gold glow behind the frame */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-brand-navy/15 via-transparent to-brand-gold/25 blur-3xl"
            />

            <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-brand-gold/20 bg-gradient-to-br from-white to-brand-gold-soft shadow-2xl">
              <div
                aria-hidden
                className="absolute inset-0 opacity-60"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(10,30,70,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(10,30,70,0.06) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div
                  key={feature.id}
                  initial={{ opacity: 0, x: reduceMotion ? 0 : 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: reduceMotion ? 0 : -40 }}
                  transition={{ duration: reduceMotion ? 0.15 : 0.5, ease: 'easeOut' }}
                  className="absolute inset-0"
                >
                  <motion.div
                    style={reduceMotion ? undefined : { y: imageY }}
                    className="absolute -inset-6"
                  >
                    <Image
                      src={feature.image || '/placeholder.svg?height=400&width=400'}
                      alt={feature.title}
                      fill
                      sizes="(min-width: 1280px) 576px, 45vw"
                      className="object-cover"
                    />
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Floating stat card, faster parallax + gentle bob */}
            <AnimatePresence initial={false} mode="wait">
              {feature.stats && (
                <motion.div
                  key={feature.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0.15 : 0.3 }}
                  className={`absolute z-10 ${CARD_POSITION[active] ?? CARD_POSITION[0]}`}
                >
                  <motion.div style={reduceMotion ? undefined : { y: cardY }}>
                    <motion.div
                      animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <StatCard stats={feature.stats} index={active} />
                    </motion.div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Step counter */}
          <p aria-hidden className="mt-8 font-figtree text-sm font-bold tracking-[0.2em] text-brand-navy">
            <span className="text-brand-gold">{pad(active + 1)}</span>
            <span className="text-brand-navy/40"> / {pad(features.length)}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
