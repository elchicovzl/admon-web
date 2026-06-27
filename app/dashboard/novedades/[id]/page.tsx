import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { getEmployeeNovedadDetail, getUsers } from '@/lib/actions'
import { NovedadEmployeeDetailClient } from './novedad-employee-detail-client'

export const metadata: Metadata = {
  title: 'Detalle de empleado | Novedades',
  description: 'Estadísticas e historial de novedades del empleado',
}

interface EmployeeDetailPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ year?: string }>
}

export default async function EmployeeNovedadDetailPage({
  params,
  searchParams,
}: EmployeeDetailPageProps) {
  const session = await auth()
  if (!session?.user) {
    redirect('/login')
  }

  const { id } = await params
  const sp = await searchParams
  const now = new Date().getUTCFullYear()
  const parsed = sp.year ? parseInt(sp.year, 10) : now
  const year = Number.isFinite(parsed) ? parsed : now

  const [detailRes, usersRes] = await Promise.all([
    getEmployeeNovedadDetail(id, year),
    getUsers(),
  ])

  if (!detailRes.success || !detailRes.data) {
    notFound()
  }

  const employees = usersRes.success
    ? (usersRes.data ?? [])
        .filter((u) => u.isActive)
        .map((u) => ({ id: u.id, name: u.name, email: u.email }))
    : []

  return (
    <NovedadEmployeeDetailClient detail={detailRes.data} employees={employees} />
  )
}
