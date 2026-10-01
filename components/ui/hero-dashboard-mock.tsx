import {
  Check,
  FileText,
  LayoutDashboard,
  Plus,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Status = "Aprobada" | "En proceso" | "Enviada"

const SIDEBAR_ICONS = [LayoutDashboard, Users, FileText, Settings] as const

const STATS = [
  { label: "Afiliaciones activas", value: "128" },
  { label: "En proceso", value: "12" },
  { label: "Planillas PILA al día", value: "100%" },
] as const

const ROWS: ReadonlyArray<{ name: string; type: string; status: Status }> = [
  { name: "Laura Gómez", type: "EPS", status: "Aprobada" },
  { name: "Andrés Ríos", type: "ARL", status: "En proceso" },
  { name: "Camila Torres", type: "Pensión", status: "Aprobada" },
  { name: "Julián Mora", type: "Caja de comp.", status: "Enviada" },
]

const STATUS_STYLES: Record<Status, string> = {
  Aprobada: "bg-brand-gold-soft text-brand-navy",
  "En proceso": "bg-gray-100 text-gray-600",
  Enviada: "bg-brand-navy/10 text-brand-navy",
}

/**
 * Static, CSS-only mock of the client dashboard used in the hero.
 * Decorative: hidden from assistive technologies.
 */
export function HeroDashboardMock({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("relative w-full max-w-xl mx-auto lg:max-w-none", className)}>
      {/* Gold glow */}
      <div className="absolute inset-4 rounded-full bg-brand-gold/15 blur-3xl" />

      <div className="relative">
        {/* Browser-like window */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-black/30">
          <div className="flex items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-4 py-3">
            <span className="size-2.5 rounded-full bg-gray-300" />
            <span className="size-2.5 rounded-full bg-gray-300" />
            <span className="size-2.5 rounded-full bg-gray-300" />
            <span className="ml-3 hidden h-5 w-40 rounded-md bg-gray-200/70 sm:block" />
          </div>

          <div className="flex">
            {/* Sidebar */}
            <div className="flex w-12 shrink-0 flex-col items-center gap-3 bg-brand-navy py-4 sm:w-14">
              {SIDEBAR_ICONS.map((Icon, index) => (
                <span
                  key={index}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg",
                    index === 1
                      ? "bg-brand-gold text-brand-navy"
                      : "text-white/60"
                  )}
                >
                  <Icon className="size-4" />
                </span>
              ))}
            </div>

            {/* Main area */}
            <div className="min-w-0 flex-1 p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-figtree text-base font-bold text-brand-navy sm:text-lg">
                  Afiliaciones
                </p>
                <Button
                  variant="brand"
                  size="sm"
                  tabIndex={-1}
                  className="pointer-events-none h-8 px-3 text-xs"
                >
                  <Plus className="mr-1 size-3.5" />
                  Nueva
                </Button>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
                {STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-gray-200 bg-surface-muted p-2.5 sm:p-3"
                  >
                    <span className="mb-2 block h-1 w-6 rounded-full bg-brand-gold" />
                    <p className="font-figtree text-xl font-bold leading-none text-brand-navy sm:text-2xl">
                      {stat.value}
                    </p>
                    <p className="mt-1.5 text-[10px] leading-tight text-gray-500 sm:text-xs">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-200">
                <div className="grid grid-cols-[1.4fr_1fr_auto] gap-2 bg-surface-muted px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500 sm:text-xs">
                  <span>Nombre</span>
                  <span>Tipo</span>
                  <span className="w-24 text-center">Estado</span>
                </div>
                {ROWS.map((row) => (
                  <div
                    key={row.name}
                    className="grid grid-cols-[1.4fr_1fr_auto] items-center gap-2 border-t border-gray-100 px-3 py-2.5 text-xs text-gray-700 sm:text-sm"
                  >
                    <span className="truncate font-medium text-brand-navy">{row.name}</span>
                    <span className="truncate text-gray-500">{row.type}</span>
                    <span
                      className={cn(
                        "w-24 whitespace-nowrap rounded-full px-2 py-0.5 text-center text-[10px] font-semibold sm:text-xs",
                        STATUS_STYLES[row.status]
                      )}
                    >
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Floating approval card */}
        <div className="absolute -bottom-14 -left-4 hidden items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-xl md:flex motion-safe:animate-float lg:-left-14">
          <span className="flex size-10 items-center justify-center rounded-full bg-brand-gold-soft">
            <Check className="size-5 text-brand-gold" strokeWidth={3} />
          </span>
          <div>
            <p className="text-sm font-bold text-brand-navy">Afiliación aprobada</p>
            <p className="text-xs text-gray-500">EPS · hace 2 min</p>
          </div>
        </div>

        {/* Floating PILA pill */}
        <div
          className="absolute -right-3 -top-4 hidden items-center gap-1.5 rounded-full bg-brand-navy-deep px-3.5 py-2 text-xs font-semibold text-white shadow-lg ring-1 ring-brand-gold/40 md:flex motion-safe:animate-float lg:-right-6"
          style={{ animationDelay: "1.5s" }}
        >
          <TrendingUp className="size-3.5 text-brand-gold" />
          PILA pagada
        </div>
      </div>
    </div>
  )
}

export default HeroDashboardMock
