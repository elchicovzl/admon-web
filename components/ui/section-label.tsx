import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface SectionLabelProps {
  children: ReactNode
  /** `light` for white/muted sections, `dark` for navy sections. */
  tone?: "light" | "dark"
  /** Replaces the default gold dot. */
  icon?: ReactNode
  className?: string
}

const toneClasses = {
  light: "bg-brand-gold-soft text-brand-navy",
  dark: "bg-white/10 text-white border border-white/15",
} as const

export function SectionLabel({
  children,
  tone = "light",
  icon,
  className,
}: SectionLabelProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        toneClasses[tone],
        className
      )}
    >
      {icon ?? (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-gold" />
      )}
      {children}
    </span>
  )
}
