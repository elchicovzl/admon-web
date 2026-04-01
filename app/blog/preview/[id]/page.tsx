import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Clock, CalendarDays, User, Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getBlogPostForPreview } from '@/lib/actions/blog.actions'
import { auth } from '@/lib/auth/auth'
import { UserRole } from '@prisma/client'
import sanitizeHtml from 'sanitize-html'

export const metadata: Metadata = {
  title: 'Vista Previa | Blog | Dashboard',
  robots: { index: false, follow: false },
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function BlogPreviewPage({ params }: PageProps) {
  // Auth guard — only MANAGER / SUPER_ADMIN
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    session.user.role !== UserRole.MANAGER
  ) {
    redirect('/dashboard')
  }

  const { id } = await params
  const result = await getBlogPostForPreview(id)

  if (!result.success || !result.data) {
    notFound()
  }

  const post = result.data
  const sanitizedContent = sanitizeHtml(post.content)

  return (
    <>
      {/* Preview banner */}
      <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
        <Eye className="h-4 w-4" />
        Vista previa — Este post no está publicado
        <Badge variant="outline" className="ml-2 border-amber-700 text-amber-900">
          {post.status}
        </Badge>
      </div>

      <article className="container mx-auto max-w-4xl px-4 py-12">
        {/* Header */}
        <header className="mb-8 space-y-4">
          {post.category && (
            <Badge variant="secondary">{post.category.name}</Badge>
          )}

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="text-lg text-muted-foreground">{post.excerpt}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {post.author.name || 'Administración Segura'}
            </span>
            {post.publishedAt ? (
              <time
                dateTime={new Date(post.publishedAt).toISOString()}
                className="flex items-center gap-1"
              >
                <CalendarDays className="h-4 w-4" />
                {format(new Date(post.publishedAt), "d 'de' MMMM, yyyy", { locale: es })}
              </time>
            ) : (
              <time
                dateTime={new Date(post.createdAt).toISOString()}
                className="flex items-center gap-1"
              >
                <CalendarDays className="h-4 w-4" />
                {format(new Date(post.createdAt), "d 'de' MMMM, yyyy", { locale: es })}
              </time>
            )}
            {post.readingTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {post.readingTime} min de lectura
              </span>
            )}
          </div>
        </header>

        {/* Featured Image */}
        {post.featuredImageUrl && (
          <div className="relative mb-8 aspect-video overflow-hidden rounded-lg">
            <Image
              src={post.featuredImageUrl}
              alt={post.title}
              fill
              priority
              className="object-cover"
              sizes="(max-width: 896px) 100vw, 896px"
            />
          </div>
        )}

        {/* Content */}
        <div
          className="prose prose-lg max-w-none prose-headings:font-bold prose-a:text-primary prose-img:rounded-lg"
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Badge key={tag.id} variant="outline">
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </article>
    </>
  )
}
