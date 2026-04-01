import { Suspense } from 'react'
import { getBlogPosts, getBlogPostsCount } from '@/lib/actions/blog.actions'
import { BlogClient } from './blog-client'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Eye, PenLine, Archive } from 'lucide-react'

export const metadata = {
  title: 'Blog | Dashboard',
}

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    status?: string
  }>
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="mb-2 h-4 w-20" />
            <Skeleton className="h-8 w-12" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="rounded-md border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b p-4">
            <Skeleton className="h-8 w-12 rounded" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}

async function BlogStats() {
  const result = await getBlogPostsCount()
  const stats = result.data

  if (!stats) return null

  const items = [
    { label: 'Total', value: stats.total, icon: FileText },
    { label: 'Publicados', value: stats.published, icon: Eye },
    { label: 'Borradores', value: stats.draft, icon: PenLine },
    { label: 'Archivados', value: stats.archived, icon: Archive },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-muted p-2">
              <item.icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="text-2xl font-bold">{item.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

async function BlogPostsList({ page, search, status }: { page: number; search: string; status: string }) {
  const result = await getBlogPosts({ page, pageSize: 20, search, status })
  const data = result.data || { posts: [], totalCount: 0, totalPages: 1, currentPage: 1 }
  return (
    <BlogClient
      posts={data.posts}
      totalCount={data.totalCount}
      totalPages={data.totalPages}
      currentPage={data.currentPage}
      initialSearch={search}
      initialStatus={status}
    />
  )
}

export default async function BlogPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1', 10))
  const search = params.search || ''
  const status = params.status || 'ALL'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
        <p className="text-muted-foreground">Gestiona las publicaciones del blog</p>
      </div>

      <Suspense fallback={<StatsSkeleton />}>
        <BlogStats />
      </Suspense>

      <Suspense fallback={<TableSkeleton />} key={`${page}-${search}-${status}`}>
        <BlogPostsList page={page} search={search} status={status} />
      </Suspense>
    </div>
  )
}
