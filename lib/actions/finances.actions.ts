'use server'

/**
 * Server Actions for the finances module.
 *
 * The module is read-only against Alegra (Alegra is the source of truth),
 * so the only mutation available here is cache invalidation.
 */

import { revalidateTag } from 'next/cache'
import { auth } from '@/lib/auth/auth'
import { ALEGRA_TAGS } from '@/lib/alegra/cache'
import type { ActionResponse } from '@/lib/types/auth.types'

/**
 * Drop every cached Alegra response so the next render hits the API fresh.
 *
 * This is the escape hatch that makes the aggressive TTL policy acceptable.
 * KPI aggregates are cached for 5 minutes; an operator who just registered a
 * payment in Alegra and wants to see it reflected NOW should not have to
 * wait out a timer or guess whether the page is lying to them.
 *
 * Auth is checked even though the action only invalidates cache: an
 * unauthenticated caller hitting this in a loop would force every
 * subsequent page render to re-fetch from Alegra, which is a cheap way to
 * burn the 150 req/min quota for the whole account. Cache invalidation is
 * not a mutation, but it is very much an amplifier.
 */
export async function refreshFinances(): Promise<ActionResponse> {
  const session = await auth()

  if (!session?.user) {
    return {
      success: false,
      error: 'No autorizado',
    }
  }

  try {
    // `all` is attached to every entry in lib/alegra/cache.ts, so this one
    // call flushes company + invoices + estimates in a single sweep.
    revalidateTag(ALEGRA_TAGS.all)

    return {
      success: true,
      message: 'Datos actualizados desde Alegra',
    }
  } catch (error) {
    console.error('[finances] refreshFinances failed:', error)
    return {
      success: false,
      error: 'No se pudo actualizar. Volvé a intentar.',
    }
  }
}
