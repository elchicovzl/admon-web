'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useSearchParams } from 'next/navigation'
import { containsActiveHref, findActiveHref } from '@/lib/nav/active-link'
import { cn } from '@/lib/utils'

/**
 * Styling for the ONE link matching the current page.
 *
 * The shadcn default is `bg-sidebar-accent`, which in this theme is
 * oklch(0.97) against a oklch(0.985) sidebar — a 1.5% luminance difference,
 * i.e. invisible. Worse, ancestors of the active item used the SAME class, so
 * "Finanzas", "Egresos" and "Pagos" all looked equally selected and none read
 * as the answer to "where am I?".
 *
 * Solid primary matches the language already used elsewhere in the app for a
 * chosen option (see the Movimiento toggle on the payments filter). The
 * `data-[active=true]:` prefix is required so tailwind-merge treats it as a
 * conflict with the component's own default and actually replaces it.
 */
const ACTIVE_LINK_CLASS =
  'data-[active=true]:bg-primary data-[active=true]:text-primary-foreground ' +
  'data-[active=true]:font-medium data-[active=true]:hover:bg-primary/90 ' +
  'data-[active=true]:hover:text-primary-foreground ' +
  // The icon needs its own override: SidebarMenuSubButton hard-codes
  // `[&>svg]:text-sidebar-accent-foreground` (oklch 0.205), which on a
  // primary background — also near-black in this theme — would render the
  // icon invisible. Text inherits the button colour; the icon does not.
  'data-[active=true]:[&>svg]:text-primary-foreground'

/**
 * Styling for a branch that CONTAINS the active link (Finanzas, Egresos).
 *
 * Deliberately no background: these are context, not destination. Weight and
 * full-strength foreground are enough to show the open path while leaving
 * exactly one element looking selected.
 */
const ACTIVE_BRANCH_CLASS = 'font-medium text-sidebar-foreground'
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  ChevronRight,
  UserCircle,
  FileText,
  ClipboardList,
  List,
  KanbanSquare,
  UserCheck,
  ChevronDown,
  Archive,
  PenSquare,
  History,
  CalendarDays,
  Wallet,
  Receipt,
  ScrollText,
  ReceiptText,
  TrendingUp,
  TrendingDown,
  Banknote,
  ArrowDownCircle,
  Coins,
  ArrowLeftRight,
  HandCoins,
  Handshake,
  BookLock,
} from 'lucide-react'
import { UserRole } from '@prisma/client'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { logout } from '@/lib/actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

/**
 * A sub-item is either a link (`href` set, no children) or a pure grouping
 * header (`href` omitted, `subItems` set). Finanzas needs the second kind:
 * "Ingresos" and "Egresos" organise the menu but have no page of their own.
 */
interface NavSubItemBase {
  title: string
  icon: React.ComponentType<{ className?: string }>
}

/** A navigable leaf. */
interface NavSubLink extends NavSubItemBase {
  href: string
  /**
   * Query param that distinguishes this entry from a sibling pointing at the
   * SAME path. "Cobros" and "Pagos" are both /finances/payments differing only
   * by `?type=`; without this they'd both highlight at once, because
   * `usePathname()` doesn't include the query string.
   */
  matchParam?: { key: string; value: string }
  /**
   * Wins the highlight when the path matches but the `matchParam` key is
   * ABSENT from the URL. Landing on /finances/payments with no `?type=`
   * (the "Movimientos de caja" view) has to light SOMETHING up, and without
   * this neither sibling matched — which left the whole Finanzas tree
   * collapsed with nothing selected.
   */
  matchFallback?: boolean
  subItems?: never
}

/** A grouping header with children and no page of its own. */
interface NavSubGroup extends NavSubItemBase {
  href?: undefined
  subItems: NavSubLink[]
}

type NavSubItem = NavSubLink | NavSubGroup

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  roles?: UserRole[]
  /**
   * Visible solo con acceso al módulo Control. Es una condición aparte de
   * `roles` porque el permiso es ortogonal al rol: un MANAGER puede tenerlo
   * sin que eso cambie nada de lo demás (ver User.canAccessControl).
   */
  requiresControlAccess?: boolean
  subItems?: NavSubItem[]
}

/**
 * Renders one sub-item: a link, or a nested collapsible group.
 *
 * Split into its own component so the two levels share exactly one code
 * path — the alternative was duplicating the link markup inside the group
 * branch, and the two copies would drift.
 */
function SubItemNode({
  item,
  activeHref,
}: {
  item: NavSubItem
  activeHref: string | null
}) {
  const ItemIcon = item.icon

  // Grouping header (Ingresos / Egresos) — collapsible, not navigable.
  if (item.subItems) {
    const hasActiveChild = containsActiveHref(item.subItems, activeHref)

    return (
      <Collapsible defaultOpen={hasActiveChild}>
        <SidebarMenuSubItem>
          <CollapsibleTrigger asChild>
            {/* isActive stays FALSE on purpose — a branch is not a
                destination. Marking it active gave it the same treatment as
                the real page and diluted the selection. */}
            <SidebarMenuSubButton
              className={cn('cursor-pointer', hasActiveChild && ACTIVE_BRANCH_CLASS)}
            >
              <ItemIcon className="h-4 w-4" />
              <span>{item.title}</span>
              <ChevronDown className="ml-auto h-4 w-4 transition-transform ui-expanded:rotate-180" />
            </SidebarMenuSubButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {/* Indented one more step so the hierarchy is readable at a glance. */}
            <SidebarMenuSub className="ml-2">
              {item.subItems.map((child) => (
                <SubItemNode key={child.href} item={child} activeHref={activeHref} />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuSubItem>
      </Collapsible>
    )
  }

  // Leaf link — the only element that gets the full active treatment.
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        asChild
        isActive={item.href === activeHref}
        className={ACTIVE_LINK_CLASS}
      >
        <Link href={item.href}>
          <ItemIcon className="h-4 w-4" />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

interface AppSidebarProps {
  user: {
    name: string | null
    email: string
    image: string | null
    role: UserRole
    /**
     * Solo decide si el ítem se DIBUJA. La autorización real vive en el
     * middleware y, sobre todo, en requireControlAccess() del lado del
     * servidor: esconder un link no protege nada.
     */
    canAccessControl?: boolean
  }
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()
  // Needed to tell "Cobros" from "Pagos" — both are /finances/payments and
  // differ only by `?type=`, which usePathname() drops.
  const searchParams = useSearchParams()
  const router = useRouter()

  const navItems: NavItem[] = [
    {
      title: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: 'Clientes',
      href: '/dashboard/clients',
      icon: UserCircle,
      roles: [UserRole.SUPER_ADMIN, UserRole.MANAGER],
    },
    {
      title: 'Procesos',
      href: '/dashboard/affiliations',
      icon: ClipboardList,
      roles: [UserRole.SUPER_ADMIN, UserRole.MANAGER],
      subItems: [
        {
          title: 'Listado',
          href: '/dashboard/affiliations',
          icon: List,
        },
        {
          title: 'Vista Kanban',
          href: '/dashboard/affiliations/kanban',
          icon: KanbanSquare,
        },
        {
          title: 'Mis Asignaciones',
          href: '/dashboard/affiliations/my-assignments',
          icon: UserCheck,
        },
        {
          title: 'Archivadas',
          href: '/dashboard/affiliations/archived',
          icon: Archive,
        },
      ],
    },
    {
      title: 'Histórico',
      href: '/dashboard/client-history',
      icon: History,
      roles: [UserRole.SUPER_ADMIN, UserRole.MANAGER],
    },
    {
      title: 'Novedades',
      href: '/dashboard/novedades',
      icon: CalendarDays,
      roles: [UserRole.SUPER_ADMIN, UserRole.MANAGER],
    },
    {
      title: 'Finanzas',
      href: '/dashboard/finances',
      icon: Wallet,
      roles: [UserRole.SUPER_ADMIN, UserRole.MANAGER],
      subItems: [
        {
          title: 'Resumen',
          href: '/dashboard/finances',
          icon: LayoutDashboard,
        },
        // Grouped by direction of money. "Facturas" alone was ambiguous —
        // it read as sales to some people and purchases to others, which is
        // exactly the confusion this split removes.
        {
          title: 'Ingresos',
          icon: TrendingUp,
          subItems: [
            {
              title: 'Facturas de venta',
              href: '/dashboard/finances/invoices',
              icon: Receipt,
            },
            {
              title: 'Cotizaciones',
              href: '/dashboard/finances/estimates',
              icon: ScrollText,
            },
            // Same page as "Pagos" below, pre-filtered by direction. A
            // collection is money coming IN, so it belongs here — landing on
            // it from Egresos and seeing incoming money was the bug.
            {
              title: 'Cobros',
              href: '/dashboard/finances/payments?type=in',
              matchParam: { key: 'type', value: 'in' },
              icon: ArrowDownCircle,
            },
          ],
        },
        {
          title: 'Egresos',
          icon: TrendingDown,
          subItems: [
            {
              title: 'Facturas de compra',
              href: '/dashboard/finances/bills',
              icon: ReceiptText,
            },
            // Also the fallback for /finances/payments with NO `?type=` (the
            // combined "Movimientos de caja" view). Something has to be
            // highlighted there, and Egresos is where this page was asked for.
            {
              title: 'Pagos',
              href: '/dashboard/finances/payments?type=out',
              matchParam: { key: 'type', value: 'out' },
              matchFallback: true,
              icon: Banknote,
            },
          ],
        },
      ],
    },
    {
      title: 'Control',
      href: '/dashboard/control',
      icon: BookLock,
      requiresControlAccess: true,
      subItems: [
        {
          title: 'Resumen',
          href: '/dashboard/control',
          icon: LayoutDashboard,
        },
        {
          title: 'Movimientos',
          href: '/dashboard/control/movimientos',
          icon: ArrowLeftRight,
        },
        {
          title: 'Préstamos',
          href: '/dashboard/control/prestamos',
          icon: HandCoins,
        },
        {
          title: 'Servicios',
          href: '/dashboard/control/servicios',
          icon: Handshake,
        },
        {
          title: 'Cierre mensual',
          href: '/dashboard/control/cierres',
          icon: Coins,
        },
      ],
    },
    {
      title: 'Blog',
      href: '/dashboard/blog',
      icon: FileText,
      roles: [UserRole.SUPER_ADMIN, UserRole.MANAGER],
      subItems: [
        {
          title: 'Listado',
          href: '/dashboard/blog',
          icon: List,
        },
        {
          title: 'Crear',
          href: '/dashboard/blog/create',
          icon: PenSquare,
        },
      ],
    },
    {
      title: 'Usuarios',
      href: '/dashboard/users',
      icon: Users,
      roles: [UserRole.SUPER_ADMIN],
    },
    {
      title: 'Configuración',
      href: '/dashboard/settings',
      icon: Settings,
    },
  ]

  const handleLogout = async () => {
    try {
      const result = await logout()
      if (result.success) {
        toast.success('Sesión cerrada exitosamente')
        router.push('/login')
        router.refresh()
      } else {
        toast.error(result.error || 'Error al cerrar sesión')
      }
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Error al cerrar sesión')
    }
  }

  const puedeVerControl =
    user.role === UserRole.SUPER_ADMIN || user.canAccessControl === true

  const filteredNavItems = navItems.filter((item) => {
    if (item.requiresControlAccess && !puedeVerControl) return false
    if (!item.roles) return true
    return item.roles.includes(user.role)
  })

  /**
   * The single sub-item to highlight, resolved across the WHOLE menu.
   *
   * Computed once at the top rather than per-node so the "most specific link
   * wins" rule is decided globally — a node can't know whether a deeper link
   * elsewhere is a better match for the current URL.
   */
  const activeHref = findActiveHref(
    filteredNavItems.flatMap((item) => item.subItems ?? []),
    pathname,
    searchParams,
  )

  const getUserInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return email[0].toUpperCase()
  }

  const getRoleBadge = (role: UserRole) => {
    if (role === UserRole.SUPER_ADMIN) {
      return 'Super Admin'
    }
    return 'Manager'
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 hover:opacity-80 transition-opacity">
          <div className="relative h-10 w-10 flex-shrink-0">
            <Image
              src="/images/logoadmon2.webp"
              alt="Administración Segura"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Administración Segura</span>
            <span className="text-xs text-muted-foreground">Dashboard</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

                // If item has sub-items, render as Collapsible
                if (item.subItems && item.subItems.length > 0) {
                  // Recursive so a match on a GRANDCHILD (e.g. /finances/bills
                  // under Egresos) still opens the top-level group.
                  const isAnySubItemActive = containsActiveHref(item.subItems, activeHref)

                  return (
                    <Collapsible key={item.href} defaultOpen={isActive || isAnySubItemActive}>
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          {/* Never `isActive` — an item with children is a
                              branch, never the destination. "Finanzas" also
                              matches /finances/payments by prefix, so marking
                              it active would put a solid background on it AND
                              on "Pagos" at the same time. Weight only. */}
                          <SidebarMenuButton
                            className={cn(
                              (isActive || isAnySubItemActive) && ACTIVE_BRANCH_CLASS,
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{item.title}</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform ui-expanded:rotate-180" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.subItems.map((subItem) => (
                              <SubItemNode
                                key={subItem.href ?? subItem.title}
                                item={subItem}
                                activeHref={activeHref}
                              />
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )
                }

                // Regular item without sub-items
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} className={ACTIVE_LINK_CLASS}>
                      <Link href={item.href}>
                        <Icon className="h-4 w-4" />
                        <span>{item.title}</span>
                        {item.badge && (
                          <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="w-full">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user.image || undefined} alt={user.name || user.email} />
                    <AvatarFallback>
                      {getUserInitials(user.name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col items-start text-left text-sm">
                    <span className="truncate font-medium">
                      {user.name || user.email}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {getRoleBadge(user.role)}
                    </span>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Configuración
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
