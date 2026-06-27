import { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { getEmployeesVacationStats, getNovedades, getUsers } from '@/lib/actions'
import { NovedadesClient } from './novedades-client'
import { NovedadesTableSkeleton } from '@/components/dashboard/novedades/novedades-table-skeleton'

export const metadata: Metadata = {
  title: 'Novedades | Dashboard',
  description: 'Reporte de vacaciones, permisos y calamidades de los empleados',
}

interface NovedadesPageProps {
  searchParams: Promise<{ year?: string }>
}

async function NovedadesContent({ year }: { year: number }) {
  const [statsRes, novedadesRes, usersRes] = await Promise.all([
    getEmployeesVacationStats(year),
    getNovedades(year),
    getUsers(),
  ])

  const stats = statsRes.success ? statsRes.data ?? [] : []
  const novedades = novedadesRes.success ? novedadesRes.data ?? [] : []
  const employees = usersRes.success
    ? (usersRes.data ?? [])
        .filter((u) => u.isActive)
        .map((u) => ({ id: u.id, name: u.name, email: u.email }))
    : []

  return (
    <NovedadesClient
      year={year}
      stats={stats}
      novedades={novedades}
      employees={employees}
    />
  )
}

export default async function NovedadesPage({ searchParams }: NovedadesPageProps) {
  const session = await auth()
  if (!session?.user) {
    redirect('/login')
  }

  const sp = await searchParams
  const now = new Date().getUTCFullYear()
  const parsed = sp.year ? parseInt(sp.year, 10) : now
  const year = Number.isFinite(parsed) ? parsed : now

  return (
    <div className="space-y-6">
      <Suspense key={year} fallback={<NovedadesTableSkeleton />}>
        <NovedadesContent year={year} />
      </Suspense>
    </div>
  )
}
