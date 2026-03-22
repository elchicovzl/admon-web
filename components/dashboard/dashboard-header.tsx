'use client'

import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { usePathname } from 'next/navigation'
import { useDashboardStore } from '@/lib/stores/use-dashboard-store'

const STATIC_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  users: 'Usuarios',
  settings: 'Configuración',
  affiliations: 'Procesos',
  subprocess: 'Sub-proceso',
  clients: 'Clientes',
  disabilities: 'Incapacidades',
  kanban: 'Kanban',
  'my-assignments': 'Mis Asignaciones',
}

export function DashboardHeader() {
  const pathname = usePathname()
  const breadcrumbLabels = useDashboardStore((s) => s.breadcrumbLabels)

  const getBreadcrumbs = () => {
    const paths = pathname.split('/').filter(Boolean)
    const breadcrumbs: Array<{ label: string; href: string; isCurrentPage: boolean }> = []

    let currentPath = ''
    paths.forEach((path, index) => {
      currentPath += `/${path}`
      const isLast = index === paths.length - 1

      // Priority: page-set override > static label > capitalize
      let label = breadcrumbLabels[path]
        || STATIC_LABELS[path]
        || path.charAt(0).toUpperCase() + path.slice(1)

      breadcrumbs.push({
        label,
        href: currentPath,
        isCurrentPage: isLast,
      })
    })

    return breadcrumbs
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((breadcrumb, index) => (
            <div key={breadcrumb.href} className="flex items-center gap-2">
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {breadcrumb.isCurrentPage ? (
                  <BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={breadcrumb.href}>
                    {breadcrumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  )
}
