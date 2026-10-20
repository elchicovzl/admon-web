import { ArrowRight, DollarSign, TrendingUp } from 'lucide-react'
import type { Feature } from '@/lib/types'

interface StatCardProps {
  stats: NonNullable<Feature['stats']>
  /** Index of the feature; each one has its own mini layout. */
  index: number
}

/** Floating stat card shown over a feature image. */
export function StatCard({ stats, index }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-brand-gold/25 bg-white/95 p-3.5 shadow-xl backdrop-blur-sm">
      {index === 0 && (
        <div className="flex items-center">
          <ArrowRight aria-hidden className="mr-2 h-5 w-5 -rotate-90 text-brand-gold" />
          <span className="text-2xl font-bold text-brand-navy">{stats.value}</span>
        </div>
      )}
      {index === 1 && (
        <>
          <div className="flex items-center">
            <span className="mr-2 text-xl font-bold text-brand-navy">AOV</span>
            <TrendingUp aria-hidden className="h-5 w-5 text-brand-gold" />
          </div>
          <div className="text-2xl font-bold text-brand-navy">{stats.value}</div>
        </>
      )}
      {index >= 2 && (
        <>
          <div className="mb-1 flex items-center">
            <DollarSign aria-hidden className="mr-1 h-5 w-5 text-brand-gold" />
            <span className="text-sm font-bold text-brand-navy">Hoy 9:45am</span>
          </div>
          <div className="relative h-12 w-24">
            <svg aria-hidden viewBox="0 0 100 50" className="h-full w-full">
              <polyline
                points="5,45 25,20 45,35 65,10 85,40 95,25"
                fill="none"
                stroke="#E0A025"
                strokeWidth="2"
              />
              <circle cx="65" cy="10" r="3" fill="#E0A025" />
            </svg>
          </div>
        </>
      )}
      <div className="text-sm text-gray-800">{stats.label}</div>
    </div>
  )
}
