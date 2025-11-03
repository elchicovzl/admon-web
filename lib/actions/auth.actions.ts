'use server'

import { signIn, signOut, auth } from '@/lib/auth/auth'
import prisma from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'
import { AuthError } from 'next-auth'
import {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  type LoginInput,
  type RegisterInput,
  type ChangePasswordInput
} from '@/lib/validations/auth.schema'
import { UserRole } from '@prisma/client'
import type { ActionResponse } from '@/lib/types/auth.types'

/**
 * Login action using NextAuth credentials provider
 */
export async function login(
  credentials: LoginInput
): Promise<ActionResponse> {
  try {
    // Validate input
    const validatedFields = loginSchema.safeParse(credentials)

    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Datos inválidos',
      }
    }

    const { email, password } = validatedFields.data

    // Attempt to sign in with NextAuth
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    return {
      success: true,
      message: 'Inicio de sesión exitoso',
    }
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return {
            success: false,
            error: 'Credenciales inválidas',
          }
        default:
          return {
            success: false,
            error: 'Error al iniciar sesión',
          }
      }
    }
    return {
      success: false,
      error: 'Error inesperado al iniciar sesión',
    }
  }
}

/**
 * Logout action
 */
export async function logout(): Promise<ActionResponse> {
  try {
    await signOut({ redirect: false })
    return {
      success: true,
      message: 'Sesión cerrada exitosamente',
    }
  } catch (error) {
    console.error('Logout error:', error)
    return {
      success: false,
      error: 'Error al cerrar sesión',
    }
  }
}

/**
 * Register a new user (only SUPER_ADMIN can create managers)
 */
export async function register(
  data: RegisterInput,
  createdByUserId?: string
): Promise<ActionResponse> {
  try {
    // Validate input
    const validatedFields = registerSchema.safeParse(data)

    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Datos inválidos',
      }
    }

    const { name, email, password, role } = validatedFields.data

    // Check if creating a manager (requires SUPER_ADMIN)
    if (role === UserRole.MANAGER && createdByUserId) {
      const creatorUser = await prisma.user.findUnique({
        where: { id: createdByUserId },
      })

      if (!creatorUser || creatorUser.role !== UserRole.SUPER_ADMIN) {
        return {
          success: false,
          error: 'No tienes permisos para crear usuarios',
        }
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
        role: role || UserRole.MANAGER,
        createdById: createdByUserId || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    })

    return {
      success: true,
      message: 'Usuario registrado exitosamente',
      data: user,
    }
  } catch (error) {
    console.error('Register error:', error)
    return {
      success: false,
      error: 'Error al registrar usuario',
    }
  }
}

/**
 * Get current session
 */
export async function getSession() {
  return await auth()
}

/**
 * Change password action
 */
export async function changePassword(
  data: ChangePasswordInput
): Promise<ActionResponse> {
  try {
    const session = await auth()

    if (!session?.user) {
      return {
        success: false,
        error: 'No autenticado',
      }
    }

    // Validate input
    const validatedFields = changePasswordSchema.safeParse(data)

    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Datos inválidos',
      }
    }

    const { currentPassword, newPassword } = validatedFields.data

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user || !user.password) {
      return {
        success: false,
        error: 'Usuario no encontrado',
      }
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password)

    if (!passwordMatch) {
      return {
        success: false,
        error: 'Contraseña actual incorrecta',
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    })

    return {
      success: true,
      message: 'Contraseña actualizada exitosamente',
    }
  } catch (error) {
    console.error('Change password error:', error)
    return {
      success: false,
      error: 'Error al cambiar contraseña',
    }
  }
}
