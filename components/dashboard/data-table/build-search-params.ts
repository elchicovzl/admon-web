/**
 * Pure URL search-params patch logic shared by every server-driven data
 * table view. Resets `page` to 1 unless `keepPage` is set (pagination
 * itself passes `keepPage: true`), and deletes a key when the patched
 * value is `undefined`, an empty string, or the `__all__` sentinel used by
 * "all" select options.
 */
export interface BuildSearchParamsOptions {
  keepPage?: boolean
}

export function buildSearchParams(
  current: string | URLSearchParams,
  patch: Record<string, string | undefined>,
  opts: BuildSearchParamsOptions = {}
): URLSearchParams {
  const params = new URLSearchParams(current)
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === '' || value === '__all__') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
  }
  if (!opts.keepPage) params.delete('page')
  return params
}
