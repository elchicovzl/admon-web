'use client'

import Image from 'next/image'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import { features } from '@/data/features'
import { StatCard } from './stat-card'

/** Mobile/tablet list: image card with overlapping stat card, then text. */
export function BenefitsList() {
  const reduceMotion = useReducedMotion()

  const variants: Variants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  }

  return (
    <div className="space-y-14 md:space-y-20">
      {features.map((feature, index) => (
        <motion.article
          key={feature.id}
          variants={variants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          className="mx-auto max-w-xl"
        >
          <div className="relative pb-6">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-brand-gold/20 bg-gradient-to-br from-white to-brand-gold-soft shadow-xl">
              <Image
                src={feature.image || '/placeholder.svg?height=400&width=400'}
                alt={feature.title}
                fill
                sizes="(min-width: 640px) 576px, 100vw"
                className="object-cover"
              />
            </div>
            {feature.stats && (
              <div className="absolute bottom-0 right-4 z-10">
                <StatCard stats={feature.stats} index={index} />
              </div>
            )}
          </div>
          <span aria-hidden className="mb-2 block text-sm font-bold tracking-[0.2em] text-brand-gold">
            {String(index + 1).padStart(2, '0')}
          </span>
          <h3 className="mb-3 font-figtree text-2xl font-bold leading-tight text-brand-navy md:text-3xl">
            {feature.title}
          </h3>
          <p className="text-base leading-relaxed text-gray-600 md:text-lg">{feature.description}</p>
        </motion.article>
      ))}
    </div>
  )
}
