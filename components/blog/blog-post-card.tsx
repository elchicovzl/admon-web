import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { SafeBlogPost } from '@/lib/types/blog.types'

interface BlogPostCardProps {
  post: SafeBlogPost
}

export function BlogPostCard({ post }: BlogPostCardProps) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <article className="overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-lg">
        {/* Image */}
        <div className="relative aspect-video overflow-hidden bg-muted">
          {post.featuredImageUrl ? (
            <Image
              src={post.featuredImageUrl}
              alt={post.title}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-4xl text-muted-foreground/20">Blog</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-2">
          {post.category && (
            <Badge variant="secondary" className="text-xs">
              {post.category.name}
            </Badge>
          )}

          <h2 className="font-semibold text-lg line-clamp-2 group-hover:text-primary transition-colors">
            {post.title}
          </h2>

          {post.excerpt && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {post.excerpt}
            </p>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2">
            {post.publishedAt && (
              <time dateTime={new Date(post.publishedAt).toISOString()}>
                {format(new Date(post.publishedAt), "d 'de' MMMM, yyyy", { locale: es })}
              </time>
            )}
            {post.readingTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {post.readingTime} min
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  )
}
