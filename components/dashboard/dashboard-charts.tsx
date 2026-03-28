/**
 * Dashboard Charts
 * Recharts-based visualizations for affiliations, clients, and disabilities
 */

'use client'

import { useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { AffiliationStats } from '@/lib/types/affiliation.types'

// ========================================
// TYPES
// ========================================

interface DashboardChartsProps {
  affiliationStats: AffiliationStats | null
  clientStats: { total: number; active: number; inactive: number; byType: { type: string; count: number }[] } | null
  disabilityStats: { total: number; active: number; inactive: number; byStatus: { status: string; count: number }[] } | null
}

// ========================================
// LABEL MAPS
// ========================================

const subProcessStatusLabels: Record<string, string> = {
  NOT_STARTED: 'Sin Iniciar',
  IN_PROGRESS: 'En Proceso',
  PENDING_SUPPORT: 'Pendiente',
  IN_REVIEW: 'En Revisión',
  COMPLETED: 'Terminado',
  RETURNED: 'Devuelto',
}

const subProcessStatusColors: Record<string, string> = {
  NOT_STARTED: 'hsl(220, 10%, 70%)',
  IN_PROGRESS: 'hsl(217, 91%, 60%)',
  PENDING_SUPPORT: 'hsl(45, 93%, 47%)',
  IN_REVIEW: 'hsl(271, 91%, 65%)',
  COMPLETED: 'hsl(142, 71%, 45%)',
  RETURNED: 'hsl(0, 84%, 60%)',
}

const subProcessTypeLabels: Record<string, string> = {
  ARL: 'ARL',
  EPS: 'EPS',
  AFP: 'AFP',
  CCF: 'CCF',
  PILA: 'Pila',
  TRASLADOS: 'Traslados',
  INCAPACIDADES: 'Incapacidades',
  CONCILIACION_MORA: 'Conc. Mora',
}

const subProcessTypeColors: Record<string, string> = {
  ARL: 'hsl(217, 91%, 60%)',
  EPS: 'hsl(142, 71%, 45%)',
  AFP: 'hsl(271, 91%, 65%)',
  CCF: 'hsl(45, 93%, 47%)',
  PILA: 'hsl(0, 84%, 60%)',
  TRASLADOS: 'hsl(180, 60%, 45%)',
  INCAPACIDADES: 'hsl(320, 70%, 55%)',
  CONCILIACION_MORA: 'hsl(30, 80%, 55%)',
}

const clientTypeLabels: Record<string, string> = {
  EMPLEADO: 'Empleado',
  EMPRESA: 'Empresa',
  INDEPENDIENTE: 'Independiente',
}

const clientTypeColors: Record<string, string> = {
  EMPLEADO: 'hsl(217, 91%, 60%)',
  EMPRESA: 'hsl(45, 93%, 47%)',
  INDEPENDIENTE: 'hsl(220, 15%, 55%)',
}

const disabilityStatusLabels: Record<string, string> = {
  NOT_STARTED: 'Por Iniciar',
  IN_PROGRESS: 'En Proceso',
  COMPLETED: 'Terminado',
  CLOSED: 'Cerrado',
  URGENT: 'Urgente',
}

const disabilityStatusColors: Record<string, string> = {
  NOT_STARTED: 'hsl(220, 10%, 70%)',
  IN_PROGRESS: 'hsl(217, 91%, 60%)',
  COMPLETED: 'hsl(142, 71%, 45%)',
  CLOSED: 'hsl(220, 15%, 55%)',
  URGENT: 'hsl(0, 84%, 60%)',
}

// ========================================
// CHART CONFIG BUILDERS
// ========================================

function buildChartConfig(labels: Record<string, string>, colors: Record<string, string>): ChartConfig {
  const config: ChartConfig = {}
  for (const key of Object.keys(labels)) {
    config[key] = { label: labels[key], color: colors[key] }
  }
  return config
}

// ========================================
// MAIN COMPONENT
// ========================================

export function DashboardCharts({ affiliationStats, clientStats, disabilityStats }: DashboardChartsProps) {
  return (
    <>
      {/* Row 1: Sub-process status bar + Sub-process type donut */}
      <div className="grid gap-4 md:grid-cols-2">
        <SubProcessStatusChart data={affiliationStats?.byStatus || []} />
        <SubProcessTypeChart
          data={affiliationStats?.bySubProcessType || []}
          notStartedData={affiliationStats?.bySubProcessTypeNotStarted || []}
        />
      </div>

      {/* Row 2: Client type bar + Disability status bar */}
      <div className="grid gap-4 md:grid-cols-2">
        <ClientTypeChart data={clientStats?.byType || []} />
        <DisabilityStatusChart data={disabilityStats?.byStatus || []} />
      </div>
    </>
  )
}

// ========================================
// SUB-PROCESS STATUS BAR CHART (HORIZONTAL)
// ========================================

function SubProcessStatusChart({ data }: { data: { status: string; count: number }[] }) {
  const chartData = data
    .map((item) => ({
      name: subProcessStatusLabels[item.status] || item.status,
      cantidad: item.count,
      fill: subProcessStatusColors[item.status] || 'hsl(220, 10%, 70%)',
    }))
    .sort((a, b) => b.cantidad - a.cantidad)

  const config = buildChartConfig(subProcessStatusLabels, subProcessStatusColors)

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sub-procesos por Estado</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
          Sin datos
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sub-procesos por Estado</CardTitle>
        <CardDescription>Distribución actual de todos los sub-procesos</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[250px] w-full">
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <YAxis
              dataKey="name"
              type="category"
              tickLine={false}
              axisLine={false}
              width={90}
              fontSize={12}
            />
            <XAxis type="number" hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar dataKey="cantidad" radius={[0, 6, 6, 0]} barSize={24}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ========================================
// SUB-PROCESS TYPE DONUT CHART
// ========================================

function SubProcessTypeChart({
  data,
  notStartedData,
}: {
  data: { type: string; count: number }[]
  notStartedData: { type: string; count: number }[]
}) {
  const [view, setView] = useState<'all' | 'notStarted'>('all')

  const sourceData = view === 'all' ? data : notStartedData

  const chartData = sourceData.map((item) => ({
    name: subProcessTypeLabels[item.type] || item.type,
    cantidad: item.count,
    fill: subProcessTypeColors[item.type] || 'hsl(220, 10%, 70%)',
  }))

  const config = buildChartConfig(subProcessTypeLabels, subProcessTypeColors)
  const total = chartData.reduce((sum, d) => sum + d.cantidad, 0)

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sub-procesos por Tipo</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
          Sin datos
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Sub-procesos por Tipo</CardTitle>
            <CardDescription>
              {view === 'all' ? 'Todos los sub-procesos' : 'Solo sin iniciar'}
            </CardDescription>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as 'all' | 'notStarted')}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs px-3 h-6">Todas</TabsTrigger>
              <TabsTrigger value="notStarted" className="text-xs px-3 h-6">Sin Iniciar</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[250px] w-full">
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent nameKey="name" hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey="cantidad"
              nameKey="name"
              innerRadius={60}
              outerRadius={95}
              strokeWidth={2}
              stroke="hsl(var(--background))"
            >
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Pie>
            <text
              x="50%"
              y="48%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-foreground text-2xl font-bold"
            >
              {total}
            </text>
            <text
              x="50%"
              y="58%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground text-xs"
            >
              total
            </text>
          </PieChart>
        </ChartContainer>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 justify-center mt-2">
          {chartData.map((item) => (
            <div key={item.name} className="flex items-center gap-1.5 text-xs">
              <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.fill }} />
              <span className="text-muted-foreground">{item.name}</span>
              <span className="font-medium">{item.cantidad}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ========================================
// CLIENT TYPE BAR CHART (VERTICAL)
// ========================================

function ClientTypeChart({ data }: { data: { type: string; count: number }[] }) {
  const chartData = data.map((item) => ({
    name: clientTypeLabels[item.type] || item.type,
    cantidad: item.count,
    fill: clientTypeColors[item.type] || 'hsl(220, 10%, 70%)',
  }))

  const config = buildChartConfig(clientTypeLabels, clientTypeColors)

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clientes por Tipo</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
          Sin datos
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Clientes por Tipo</CardTitle>
        <CardDescription>Empleados, empresas e independientes</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[250px] w-full">
          <BarChart data={chartData} margin={{ left: 0, right: 16 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              fontSize={12}
            />
            <YAxis hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar dataKey="cantidad" radius={[6, 6, 0, 0]} barSize={48}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ========================================
// DISABILITY STATUS BAR CHART (HORIZONTAL)
// ========================================

function DisabilityStatusChart({ data }: { data: { status: string; count: number }[] }) {
  const chartData = data
    .map((item) => ({
      name: disabilityStatusLabels[item.status] || item.status,
      cantidad: item.count,
      fill: disabilityStatusColors[item.status] || 'hsl(220, 10%, 70%)',
    }))
    .sort((a, b) => b.cantidad - a.cantidad)

  const config = buildChartConfig(disabilityStatusLabels, disabilityStatusColors)

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Incapacidades por Estado</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
          Sin datos
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Incapacidades por Estado</CardTitle>
        <CardDescription>Estado actual de las incapacidades activas</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[250px] w-full">
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <YAxis
              dataKey="name"
              type="category"
              tickLine={false}
              axisLine={false}
              width={80}
              fontSize={12}
            />
            <XAxis type="number" hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar dataKey="cantidad" radius={[0, 6, 6, 0]} barSize={24}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
