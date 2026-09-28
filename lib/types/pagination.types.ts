/**
 * Generic shape for a server-paginated list result. Shared by every
 * server-driven data table view (My Assignments, Archived, Client History).
 */
export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
