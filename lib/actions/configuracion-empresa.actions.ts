'use server'

import { revalidatePath } from 'next/cache'
import { UserRole } from '@prisma/client'
import { auth } from '@/lib/auth/auth'
import prisma from '@/lib/db/prisma'
import { CONFIGURACION_EMPRESA_ID } from '@/lib/config/recibo-emisor'
import {
  configuracionEmpresaSchema,
  type ConfiguracionEmpresaInput,
} from '@/lib/validations/configuracion-empresa.schema'
import type { ActionResponse } from '@/lib/types/auth.types'

export interface ConfiguracionEmpresa extends ConfiguracionEmpresaInput {
  updatedAt: Date
}

/**
 * Company data printed on receipts. Any authenticated dashboard user can read
 * it; returns null data-wise when it was never configured.
 */
export async function getConfiguracionEmpresa(): Promise<
  ActionResponse<ConfiguracionEmpresa | null>
> {
  try {
    const session = await auth()
    if (!session?.user) {
      return { success: false, error: 'No autenticado' }
    }

    const fila = await prisma.configuracionEmpresa.findUnique({
      where: { id: CONFIGURACION_EMPRESA_ID },
      select: {
        razonSocial: true,
        nit: true,
        direccion: true,
        ciudad: true,
        telefono: true,
        email: true,
        updatedAt: true,
      },
    })

    return { success: true, data: fila }
  } catch (error) {
    console.error('Get configuracion empresa error:', error)
    return { success: false, error: 'Error al obtener los datos de la empresa' }
  }
}

/** SUPER_ADMIN only: upserts the singleton company row. */
export async function updateConfiguracionEmpresa(
  input: ConfiguracionEmpresaInput
): Promise<ActionResponse> {
  try {
    const session = await auth()
    if (!session?.user) {
      return { success: false, error: 'No autenticado' }
    }
    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return { success: false, error: 'No tienes permisos para esta acción' }
    }

    const parsed = configuracionEmpresaSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Datos inválidos',
      }
    }

    await prisma.configuracionEmpresa.upsert({
      where: { id: CONFIGURACION_EMPRESA_ID },
      create: { id: CONFIGURACION_EMPRESA_ID, ...parsed.data, updatedById: session.user.id },
      update: { ...parsed.data, updatedById: session.user.id },
    })

    revalidatePath('/dashboard/settings')

    return { success: true, message: 'Datos de la empresa actualizados' }
  } catch (error) {
    console.error('Update configuracion empresa error:', error)
    return { success: false, error: 'Error al actualizar los datos de la empresa' }
  }
}
