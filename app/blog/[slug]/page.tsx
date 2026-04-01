import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Script from 'next/script'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Clock, CalendarDays, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Suspense } from 'react'
import { getBlogPostBySlug, getAllPublishedSlugs } from '@/lib/actions/blog.actions'
import { BlogShareButtons } from '@/components/blog/blog-share-buttons'
import { BlogRelatedPosts } from '@/components/blog/blog-related-posts'
import sanitizeHtml from 'sanitize-html'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://administracionsegura.com'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const result = await getAllPublishedSlugs()
  return (result.data || []).map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const result = await getBlogPostBySlug(slug)
  const post = result.data

  if (!post) {
    return {
      title: 'Artículo no encontrado | Administración Segura',
      robots: { index: false, follow: false },
    }
  }

  const title = post.metaTitle || post.title
  const description = post.metaDescription || post.excerpt || ''
  const canonicalUrl = `${BASE_URL}/blog/${slug}`
  const ogImage = post.ogImageUrl || post.featuredImageUrl

  return {
    title: `${title} | Blog | Administración Segura`,
    description,
    keywords: post.keywords || undefined,
    alternates: {
      canonical: canonicalUrl,
    },
    authors: [{ name: post.author.name || 'Administración Segura' }],
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Administración Segura',
      locale: 'es_CO',
      type: 'article',
      publishedTime: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
      modifiedTime: new Date(post.updatedAt).toISOString(),
      authors: [post.author.name || 'Administración Segura'],
      tags: post.tags?.map((t) => t.name),
      images: ogImage
        ? [{ url: ogImage, width: 1200, height: 630, alt: title }]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }
}

function generateArticleJsonLd(post: NonNullable<Awaited<ReturnType<typeof getBlogPostBySlug>>['data']>, slug: string) {
  const canonicalUrl = `${BASE_URL}/blog/${slug}`

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': canonicalUrl,
    headline: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt || '',
    image: post.ogImageUrl || post.featuredImageUrl || undefined,
    datePublished: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
    dateModified: new Date(post.updatedAt).toISOString(),
    author: {
      '@type': 'Person',
      name: post.author.name || 'Administración Segura',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Administración Segura',
      url: BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/images/logoadmon2.webp`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    keywords: post.keywords || undefined,
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: canonicalUrl },
    ],
  }

  return { articleSchema, breadcrumbSchema }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const result = await getBlogPostBySlug(slug)

  if (!result.success || !result.data) {
    notFound()
  }

  const post = result.data
  const postUrl = `${BASE_URL}/blog/${slug}`
  const sanitizedContent = sanitizeHtml(post.content)
  const { articleSchema, breadcrumbSchema } = generateArticleJsonLd(post, slug)

  return (
    <>
      {/* JSON-LD */}
      <Script
        id="article-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <Script
        id="breadcrumb-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

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
            {post.publishedAt && (
              <time
                dateTime={new Date(post.publishedAt).toISOString()}
                className="flex items-center gap-1"
              >
                <CalendarDays className="h-4 w-4" />
                {format(new Date(post.publishedAt), "d 'de' MMMM, yyyy", { locale: es })}
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

        {/* Share */}
        <div className="mt-8 border-t pt-6">
          <BlogShareButtons title={post.title} url={postUrl} />
        </div>

        {/* Related posts */}
        <Suspense fallback={null}>
          <BlogRelatedPosts postId={post.id} categoryId={post.category?.id || null} />
        </Suspense>
      </article>
    </>
  )
}
