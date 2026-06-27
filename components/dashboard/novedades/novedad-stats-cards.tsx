import { CalendarCheck, CalendarMinus, Clock, HeartPulse } from 'lucide-react'
import type { EmployeeVacationStats } from '@/lib/types/novedad.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface NovedadStatsCardsProps {
  stats: EmployeeVacationStats
}

export function NovedadStatsCards({ stats }: NovedadStatsCardsProps) {
  const cards = [
    {
      title: 'Días disponibles',
      value: `${stats.availableDays} / ${stats.annualDays}`,
      icon: CalendarCheck,
      hint: 'Saldo de vacaciones del año',
    },
    {
      title: 'Días usados',
      value: stats.usedDays,
      icon: CalendarMinus,
      hint: `${stats.vacacionesCount} registro(s) de vacaciones`,
    },
    {
      title: 'Permisos',
      value: stats.permisosCount,
      icon: Clock,
      hint: stats.permisosHours > 0 ? `${stats.permisosHours} horas en total` : 'Sin horas registradas',
    },
    {
      title: 'Calamidades',
      value: stats.calamidadCount,
      icon: HeartPulse,
      hint: 'No descuentan vacaciones',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
