'use client'

/**
 * "Actualizar" button for the finances module.
 *
 * Counterpart to the cache TTLs in `lib/alegra/cache.ts`. KPI aggregates are
 * cached for 5 minutes, which means an operator who just registered a payment
 * in Alegra can look at a stale number and reasonably conclude the dashboard
 * is broken. This gives them a way to force the truth without waiting.
 *
 * Uses `useTransition` rather than local `isLoading` state: the Server Action
 * invalidates the cache, and the resulting re-render streams new data in.
 * `isPending` stays true for the WHOLE round trip — action plus re-render —
 * so the spinner stops when fresh numbers are actually on screen, not when
 * the action returned.
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { refreshFinances } from '@/lib/actions/finances.actions'

interface RefreshButtonProps {
  /** Optional label override. Defaults to "Actualizar". */
  label?: string
  className?: string
}

export function RefreshButton({ label = 'Actualizar', className }: RefreshButtonProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleClick = () => {
    startTransition(async () => {
      const result = await refreshFinances()

      if (!result.success) {
        toast.error(result.error ?? 'No se pudo actualizar')
        return
      }

      // `revalidateTag` clears the server cache but does not by itself
      // re-render the current route — refresh() is what pulls the new data
      // down. Inside the transition so `isPending` covers it.
      router.refresh()
      toast.success(result.message ?? 'Datos actualizados')
    })
  }

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      disabled={isPending}
      aria-label="Actualizar datos desde Alegra"
      className={cn('gap-2', className)}
    >
      <RefreshCw className={cn('h-4 w-4', isPending && 'animate-spin')} aria-hidden />
      {isPending ? 'Actualizando…' : label}
    </Button>
  )
}
