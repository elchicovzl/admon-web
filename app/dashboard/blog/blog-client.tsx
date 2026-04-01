'use client'

import { useState, useCallback, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { BlogPostStatus } from '@prisma/client'
import { Plus, Pencil, Trash2, ExternalLink, MoreHorizontal, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { BlogStatusBadge } from '@/components/dashboard/blog/blog-status-badge'
import { deleteBlogPost, toggleBlogPostStatus } from '@/lib/actions/blog.actions'
import type { SafeBlogPost } from '@/lib/types/blog.types'
import { toast } from 'sonner'
import Image from 'next/image'

interface BlogClientProps {
  posts: SafeBlogPost[]
  totalCount: number
  totalPages: number
  currentPage: number
  initialSearch: string
  initialStatus: string
}

export function BlogClient({
  posts: initialPosts,
  totalCount,
  totalPages,
  currentPage,
  initialSearch,
  initialStatus,
}: BlogClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()

  const [posts, setPosts] = useState(initialPosts)
  const [search, setSearch] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Sync local state with incoming server data when props change
  // (happens on navigation)
  if (initialPosts !== posts) {
    setPosts(initialPosts)
  }

  function buildUrl(updates: Record<string, string>) {
    const params = new URLSearchParams()
    const merged = {
      page: String(currentPage),
      search: initialSearch,
      status: initialStatus,
      ...updates,
    }
    if (merged.page && merged.page !== '1') params.set('page', merged.page)
    if (merged.search) params.set('search', merged.search)
    if (merged.status && merged.status !== 'ALL') params.set('status', merged.status)
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const handleSearchCommit = useCallback(() => {
    startTransition(() => {
      router.push(buildUrl({ search, status: statusFilter, page: '1' }))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearchCommit()
  }, [handleSearchCommit])

  const handleStatusChange = useCallback((value: string) => {
    setStatusFilter(value)
    startTransition(() => {
      router.push(buildUrl({ status: value, search, page: '1' }))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const handlePageChange = useCallback((page: number) => {
    startTransition(() => {
      router.push(buildUrl({ page: String(page) }))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, initialSearch, initialStatus])

  async function handleDelete(id: string) {
    const result = await deleteBlogPost(id)
    if (result.success) {
      setPosts((prev) => prev.filter((p) => p.id !== id))
      toast.success('Post movido a la papelera')
      // Refresh server data
      startTransition(() => router.refresh())
    } else {
      toast.error(result.error || 'Error al eliminar')
    }
    setDeleteId(null)
  }

  async function handleStatusToggle(id: string, status: BlogPostStatus) {
    const result = await toggleBlogPostStatus(id, status)
    if (result.success && result.data) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, status: result.data!.status, publishedAt: result.data!.publishedAt } : p,
        ),
      )
      toast.success('Estado actualizado')
    } else {
      toast.error(result.error || 'Error al cambiar estado')
    }
  }

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Input
            placeholder="Buscar posts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={handleSearchCommit}
            className="w-64"
          />
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="DRAFT">Borradores</SelectItem>
              <SelectItem value="PUBLISHED">Publicados</SelectItem>
              <SelectItem value="ARCHIVED">Archivados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Link href="/dashboard/blog/create">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Crear Post
          </Button>
        </Link>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16" />
              <TableHead>Título</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Autor</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No se encontraron posts
                </TableCell>
              </TableRow>
            ) : (
              posts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell>
                    {post.featuredImageUrl ? (
                      <Image
                        src={post.featuredImageUrl}
                        alt=""
                        width={48}
                        height={32}
                        className="h-8 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="h-8 w-12 rounded bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/blog/${post.id}/edit`}
                      className="hover:underline"
                    >
                      {post.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <BlogStatusBadge status={post.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {post.category?.name || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {post.author.name || post.author.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {post.publishedAt
                      ? format(new Date(post.publishedAt), 'dd MMM yyyy', { locale: es })
                      : format(new Date(post.createdAt), 'dd MMM yyyy', { locale: es })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/blog/${post.id}/edit`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/blog/preview/${post.id}`} target="_blank">
                            <Eye className="mr-2 h-4 w-4" />
                            Vista previa
                          </Link>
                        </DropdownMenuItem>
                        {post.status === 'PUBLISHED' && (
                          <DropdownMenuItem asChild>
                            <Link href={`/blog/${post.slug}`} target="_blank">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Ver en sitio
                            </Link>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {post.status !== 'PUBLISHED' && (
                          <DropdownMenuItem onClick={() => handleStatusToggle(post.id, BlogPostStatus.PUBLISHED)}>
                            Publicar
                          </DropdownMenuItem>
                        )}
                        {post.status !== 'DRAFT' && (
                          <DropdownMenuItem onClick={() => handleStatusToggle(post.id, BlogPostStatus.DRAFT)}>
                            Mover a borrador
                          </DropdownMenuItem>
                        )}
                        {post.status !== 'ARCHIVED' && (
                          <DropdownMenuItem onClick={() => handleStatusToggle(post.id, BlogPostStatus.ARCHIVED)}>
                            Archivar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(post.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{totalCount} posts en total</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Post</AlertDialogTitle>
            <AlertDialogDescription>
              El post será movido a la papelera y dejará de ser visible. Podés restaurarlo si es necesario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
