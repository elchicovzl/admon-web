import { Metadata } from 'next'
import { getPublishedBlogPosts, getBlogCategories } from '@/lib/actions/blog.actions'
import { BlogPostCard } from '@/components/blog/blog-post-card'
import { BlogPagination } from '@/components/blog/blog-pagination'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://administracionsegura.co'

export const metadata: Metadata = {
  title: 'Blog | Administración Segura',
  description: 'Artículos sobre seguridad social, afiliaciones, EPS, AFP, ARL y más. Mantente informado con Administración Segura.',
  alternates: {
    canonical: `${BASE_URL}/blog`,
  },
  openGraph: {
    title: 'Blog | Administración Segura',
    description: 'Artículos sobre seguridad social, afiliaciones, EPS, AFP, ARL y más.',
    url: `${BASE_URL}/blog`,
    siteName: 'Administración Segura',
    locale: 'es_CO',
    type: 'website',
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

interface PageProps {
  searchParams: Promise<{ page?: string; categoria?: string }>
}

export default async function BlogPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const categorySlug = params.categoria

  const [postsResult, categoriesResult] = await Promise.all([
    getPublishedBlogPosts(page, 9, categorySlug),
    getBlogCategories(),
  ])

  const { posts, totalPages, currentPage } = postsResult.data || {
    posts: [],
    totalPages: 0,
    currentPage: 1,
  }
  const categories = categoriesResult.data || []

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Blog</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Artículos sobre seguridad social y gestión empresarial
        </p>
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
          <Link href="/blog">
            <Badge variant={!categorySlug ? 'default' : 'outline'} className="cursor-pointer">
              Todos
            </Badge>
          </Link>
          {categories.map((cat) => (
            <Link key={cat.id} href={`/blog?categoria=${cat.slug}`}>
              <Badge
                variant={categorySlug === cat.slug ? 'default' : 'outline'}
                className="cursor-pointer"
              >
                {cat.name}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {/* Posts grid */}
      {posts.length > 0 ? (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <BlogPostCard key={post.id} post={post} />
            ))}
          </div>

          <div className="mt-8">
            <BlogPagination
              currentPage={currentPage}
              totalPages={totalPages}
              categorySlug={categorySlug}
            />
          </div>
        </>
      ) : (
        <div className="py-20 text-center">
          <p className="text-lg text-muted-foreground">
            {categorySlug
              ? 'No hay artículos en esta categoría todavía.'
              : 'No hay artículos publicados todavía.'}
          </p>
        </div>
      )}
    </div>
  )
}
