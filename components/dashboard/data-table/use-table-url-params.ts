'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { buildSearchParams, type BuildSearchParamsOptions } from './build-search-params'

export type UpdateUrlFn = (
  patch: Record<string, string | undefined>,
  opts?: BuildSearchParamsOptions
) => void

export interface UseTableUrlParamsResult {
  searchParams: ReturnType<typeof useSearchParams>
  updateUrl: UpdateUrlFn
  isPending: boolean
  /** Exposed so callers can wrap other navigations (e.g. a row click) in the
   * same pending transition as URL updates. */
  startTransition: ReturnType<typeof useTransition>[1]
}

/**
 * Single source of truth for a server-driven table's URL state. Call this
 * ONCE per view (e.g. in the top-level client component) and pass
 * `updateUrl` / `isPending` down to `ServerDataTable` and any toolbar
 * filters, so every URL write — filters, sorting, pagination, row
 * navigation — shares the same pending transition.
 */
export function useTableUrlParams(): UseTableUrlParamsResult {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const updateUrl = useCallback<UpdateUrlFn>(
    (patch, opts) => {
      const params = buildSearchParams(searchParams.toString(), patch, opts)
      const qs = params.toString()
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [pathname, router, searchParams]
  )

  return { searchParams, updateUrl, isPending, startTransition }
}

/**
 * Debounced (350ms default) two-way binding between a single URL param and
 * local input state — for a text filter. Takes the `updateUrl` from
 * `useTableUrlParams()` so it shares that hook's single pending transition
 * instead of creating its own.
 */
export function useDebouncedUrlParam(
  key: string,
  updateUrl: UpdateUrlFn,
  currentValue: string,
  delay = 350
): [string, (value: string) => void] {
  const [value, setValue] = useState(currentValue)

  // Sync local state with the URL when it changes externally (e.g. "clear filters")
  useEffect(() => setValue(currentValue), [currentValue])

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (value === currentValue) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => updateUrl({ [key]: value || undefined }), delay)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [value, currentValue, key, delay, updateUrl])

  return [value, setValue]
}
