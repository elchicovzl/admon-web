'use server'

import { auth } from '@/lib/auth/auth'
import prisma from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'
import {
  createUserSchema,
  updateUserSchema,
  deleteUserSchema,
  changeUserPasswordSchema,
  toggleUserStatusSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from '@/lib/validations/user.schema'
import type { ActionResponse, SafeUser } from '@/lib/types/auth.types'
import { revalidatePath } from 'next/cache'

/**
 * Check if user has SUPER_ADMIN role
 */
async function requireSuperAdmin() {
  const session = await auth()

  if (!session?.user) {
    return { authorized: false, error: 'No autenticado' }
  }

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    return { authorized: false, error: 'No tienes permisos para esta acción' }
  }

  return { authorized: true, userId: session.user.id }
}

/**
 * Get all users (with optional role filter)
 */
export async function getUsers(
  role?: UserRole
): Promise<ActionResponse<SafeUser[]>> {
  try {
    const session = await auth()

    if (!session?.user) {
      return {
        success: false,
        error: 'No autenticado',
      }
    }

    const users = await prisma.user.findMany({
      where: role ? { role } : undefined,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return {
      success: true,
      data: users,
    }
  } catch (error) {
    console.error('Get users error:', error)
    return {
      success: false,
      error: 'Error al obtener usuarios',
    }
  }
}

/**
 * Get user by ID
 */
export async function getUserById(
  id: string
): Promise<ActionResponse<SafeUser>> {
  try {
    const session = await auth()

    if (!session?.user) {
      return {
        success: false,
        error: 'No autenticado',
      }
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return {
        success: false,
        error: 'Usuario no encontrado',
      }
    }

    return {
      success: true,
      data: user,
    }
  } catch (error) {
    console.error('Get user error:', error)
    return {
      success: false,
      error: 'Error al obtener usuario',
    }
  }
}

/**
 * Create a new manager (only SUPER_ADMIN can do this)
 */
export async function createManager(
  data: CreateUserInput
): Promise<ActionResponse<SafeUser>> {
  try {
    // Check authorization
    const authCheck = await requireSuperAdmin()
    if (!authCheck.authorized) {
      return {
        success: false,
        error: authCheck.error,
      }
    }

    // Validate input
    const validatedFields = createUserSchema.safeParse(data)

    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Datos inválidos',
      }
    }

    const { name, email, password, role } = validatedFields.data

    // Only allow creating managers
    if (role === UserRole.SUPER_ADMIN) {
      return {
        success: false,
        error: 'No puedes crear Super Admins',
      }
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return {
        success: false,
        error: 'El email ya está registrado',
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: UserRole.MANAGER,
        createdById: authCheck.userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    revalidatePath('/dashboard/users')

    return {
      success: true,
      message: 'Manager creado exitosamente',
      data: user,
    }
  } catch (error) {
    console.error('Create manager error:', error)
    return {
      success: false,
      error: 'Error al crear manager',
    }
  }
}

/**
 * Update user (only SUPER_ADMIN can update)
 */
export async function updateUser(
  id: string,
  data: UpdateUserInput
): Promise<ActionResponse<SafeUser>> {
  try {
    // Check authorization
    const authCheck = await requireSuperAdmin()
    if (!authCheck.authorized) {
      return {
        success: false,
        error: authCheck.error,
      }
    }

    // Validate input
    const validatedFields = updateUserSchema.safeParse(data)

    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Datos inválidos',
      }
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    })

    if (!existingUser) {
      return {
        success: false,
        error: 'Usuario no encontrado',
      }
    }

    // Prevent changing SUPER_ADMIN role
    if (existingUser.role === UserRole.SUPER_ADMIN) {
      return {
        success: false,
        error: 'No puedes modificar un Super Admin',
      }
    }

    // If email is being updated, check it's not taken
    if (data.email && data.email !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email: data.email },
      })

      if (emailTaken) {
        return {
          success: false,
          error: 'El email ya está en uso',
        }
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: validatedFields.data,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    revalidatePath('/dashboard/users')

    return {
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: updatedUser,
    }
  } catch (error) {
    console.error('Update user error:', error)
    return {
      success: false,
      error: 'Error al actualizar usuario',
    }
  }
}

/**
 * Delete user (only SUPER_ADMIN can delete)
 */
export async function deleteUser(id: string): Promise<ActionResponse> {
  try {
    // Check authorization
    const authCheck = await requireSuperAdmin()
    if (!authCheck.authorized) {
      return {
        success: false,
        error: authCheck.error,
      }
    }

    // Validate input
    const validatedFields = deleteUserSchema.safeParse({ id })

    if (!validatedFields.success) {
      return {
        success: false,
        error: 'ID de usuario inválido',
      }
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      return {
        success: false,
        error: 'Usuario no encontrado',
      }
    }

    // Prevent deleting SUPER_ADMIN
    if (user.role === UserRole.SUPER_ADMIN) {
      return {
        success: false,
        error: 'No puedes eliminar un Super Admin',
      }
    }

    // Prevent self-deletion
    if (user.id === authCheck.userId) {
      return {
        success: false,
        error: 'No puedes eliminarte a ti mismo',
      }
    }

    // Delete user
    await prisma.user.delete({
      where: { id },
    })

    revalidatePath('/dashboard/users')

    return {
      success: true,
      message: 'Usuario eliminado exitosamente',
    }
  } catch (error) {
    console.error('Delete user error:', error)
    return {
      success: false,
      error: 'Error al eliminar usuario',
    }
  }
}

/**
 * Get users count by role
 */
export async function getUsersCount(): Promise<
  ActionResponse<{
    total: number
    superAdmins: number
    managers: number
  }>
> {
  try {
    const session = await auth()

    if (!session?.user) {
      return {
        success: false,
        error: 'No autenticado',
      }
    }

    const [total, superAdmins, managers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: UserRole.SUPER_ADMIN } }),
      prisma.user.count({ where: { role: UserRole.MANAGER } }),
    ])

    return {
      success: true,
      data: {
        total,
        superAdmins,
        managers,
      },
    }
  } catch (error) {
    console.error('Get users count error:', error)
    return {
      success: false,
      error: 'Error al obtener conteo de usuarios',
    }
  }
}

/**
 * Toggle user active status (instead of delete)
 * Only SUPER_ADMIN can do this
 */
export async function toggleUserStatus(
  userId: string,
  isActive: boolean
): Promise<ActionResponse> {
  try {
    const authCheck = await requireSuperAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validar input
    const validatedFields = toggleUserStatusSchema.safeParse({ userId, isActive })
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    // Verificar que el usuario existe
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return { success: false, error: 'Usuario no encontrado' }
    }

    // No se puede desactivar SUPER_ADMIN
    if (user.role === UserRole.SUPER_ADMIN) {
      return { success: false, error: 'No puedes cambiar el status de un Super Admin' }
    }

    // No puede cambiar su propio status
    if (user.id === authCheck.userId) {
      return { success: false, error: 'No puedes cambiar tu propio status' }
    }

    // Actualizar status
    await prisma.user.update({
      where: { id: userId },
      data: { isActive },
    })

    revalidatePath('/dashboard/users')

    return {
      success: true,
      message: `Usuario ${isActive ? 'activado' : 'desactivado'} exitosamente`,
    }
  } catch (error) {
    console.error('Toggle user status error:', error)
    return { success: false, error: 'Error al cambiar status del usuario' }
  }
}

/**
 * Change password of a user (only SUPER_ADMIN can change manager passwords)
 */
export async function changeUserPassword(
  userId: string,
  newPassword: string
): Promise<ActionResponse> {
  try {
    const authCheck = await requireSuperAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validar input
    const validatedFields = changeUserPasswordSchema.safeParse({ userId, newPassword })
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    // Verificar que el usuario existe
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return { success: false, error: 'Usuario no encontrado' }
    }

    // No se puede cambiar password de SUPER_ADMIN
    if (user.role === UserRole.SUPER_ADMIN) {
      return { success: false, error: 'No puedes cambiar el password de un Super Admin' }
    }

    // Hash del nuevo password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Actualizar password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    revalidatePath('/dashboard/users')

    return {
      success: true,
      message: 'Contraseña actualizada exitosamente',
    }
  } catch (error) {
    console.error('Change user password error:', error)
    return { success: false, error: 'Error al cambiar contraseña' }
  }
}
