'use client'

import { useState } from 'react'
import { UserRole } from '@prisma/client'
import type { SafeUser } from '@/lib/types/auth.types'
import { toggleUserStatus } from '@/lib/actions'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MoreHorizontal, Shield, UserCheck, Ban, CheckCircle, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { EditUserForm } from './edit-user-form'

interface UsersTableProps {
  users: SafeUser[]
}

export function UsersTable({ users }: UsersTableProps) {
  const [isTogglingStatus, setIsTogglingStatus] = useState(false)
  const [editingUser, setEditingUser] = useState<SafeUser | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

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

  const handleToggleStatus = async (user: SafeUser) => {
    setIsTogglingStatus(true)

    try {
      const result = await toggleUserStatus(user.id, !user.isActive)

      if (result.success) {
        toast.success(result.message || 'Status actualizado exitosamente')
      } else {
        toast.error(result.error || 'Error al cambiar status')
      }
    } catch (error) {
      console.error('Toggle status error:', error)
      toast.error('Error inesperado al cambiar status')
    } finally {
      setIsTogglingStatus(false)
    }
  }

  const handleEdit = (user: SafeUser) => {
    setEditingUser(user)
    setEditDialogOpen(true)
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Fecha de Registro</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No hay usuarios registrados
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={user.image ? `/api/avatar/${user.id}` : undefined}
                          alt={user.name || user.email}
                        />
                        <AvatarFallback>
                          {getUserInitials(user.name, user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.name || 'Sin nombre'}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.role === UserRole.SUPER_ADMIN ? (
                      <Badge variant="default" className="gap-1">
                        <Shield className="h-3 w-3" />
                        Super Admin
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <UserCheck className="h-3 w-3" />
                        Manager
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.isActive ? (
                      <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                        <CheckCircle className="h-3 w-3" />
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-red-600 border-red-600">
                        <Ban className="h-3 w-3" />
                        Inactivo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(user.createdAt), "d 'de' MMMM, yyyy", { locale: es })}
                  </TableCell>
                  <TableCell className="text-right">
                    {user.role !== UserRole.SUPER_ADMIN && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0" disabled={isTogglingStatus}>
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEdit(user)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar Usuario
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
                            {user.isActive ? (
                              <>
                                <Ban className="mr-2 h-4 w-4" />
                                Desactivar Usuario
                              </>
                            ) : (
                              <>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Activar Usuario
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editingUser && (
        <EditUserForm
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          user={editingUser}
        />
      )}
    </>
  )
}
