'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  ChevronRight,
  UserCircle,
  FileText,
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

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  roles?: UserRole[]
}

interface AppSidebarProps {
  user: {
    name: string | null
    email: string
    image: string | null
    role: UserRole
  }
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()
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
      title: 'Incapacidades',
      href: '/dashboard/disabilities',
      icon: FileText,
      roles: [UserRole.SUPER_ADMIN, UserRole.MANAGER],
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

  const filteredNavItems = navItems.filter((item) => {
    if (!item.roles) return true
    return item.roles.includes(user.role)
  })

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
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LayoutDashboard className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Admon Web</span>
            <span className="text-xs text-muted-foreground">Dashboard</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
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
