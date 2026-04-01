import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface BlogPaginationProps {
  currentPage: number
  totalPages: number
  basePath?: string
  categorySlug?: string
}

export function BlogPagination({ currentPage, totalPages, basePath = '/blog', categorySlug }: BlogPaginationProps) {
  if (totalPages <= 1) return null

  function getPageUrl(page: number) {
    const params = new URLSearchParams()
    if (page > 1) params.set('page', String(page))
    if (categorySlug) params.set('categoria', categorySlug)
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Paginación">
      {currentPage > 1 ? (
        <Link href={getPageUrl(currentPage - 1)}>
          <Button variant="outline" size="sm">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Anterior
          </Button>
        </Link>
      ) : (
        <Button variant="outline" size="sm" disabled>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Anterior
        </Button>
      )}

      <span className="text-sm text-muted-foreground">
        Página {currentPage} de {totalPages}
      </span>

      {currentPage < totalPages ? (
        <Link href={getPageUrl(currentPage + 1)}>
          <Button variant="outline" size="sm">
            Siguiente
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Siguiente
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      )}
    </nav>
  )
}
