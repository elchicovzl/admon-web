/**
 * Shared parsing for the `page` / `pageSize` / `sortDir` search params every
 * server-driven data table view reads from the URL (My Assignments, Archived,
 * Client History). View-specific filters (q, status, etc.) stay in each
 * page.tsx.
 */

const DEFAULT_PAGE_SIZE = 25
const MIN_PAGE_SIZE = 5
const MAX_PAGE_SIZE = 200

export interface RawPaginationParams {
  page?: string
  pageSize?: string
  sortDir?: string
}

export interface ParsedPaginationParams {
  page: number
  pageSize: number
  sortDir: 'asc' | 'desc' | undefined
}

export function parsePaginationParams(sp: RawPaginationParams): ParsedPaginationParams {
  return {
    page: sp.page ? Math.max(1, parseInt(sp.page, 10) || 1) : 1,
    pageSize: sp.pageSize
      ? Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, parseInt(sp.pageSize, 10) || DEFAULT_PAGE_SIZE))
      : DEFAULT_PAGE_SIZE,
    sortDir: sp.sortDir === 'asc' || sp.sortDir === 'desc' ? sp.sortDir : undefined,
  }
}
