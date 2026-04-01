import { notFound } from 'next/navigation'
import { getBlogPostById, getBlogCategories, getBlogTags } from '@/lib/actions/blog.actions'
import { BlogPostForm } from '@/components/dashboard/blog/blog-post-form'

export const metadata = {
  title: 'Editar Post | Blog | Dashboard',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditBlogPostPage({ params }: PageProps) {
  const { id } = await params

  const [postResult, categoriesResult, tagsResult] = await Promise.all([
    getBlogPostById(id),
    getBlogCategories(),
    getBlogTags(),
  ])

  if (!postResult.success || !postResult.data) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-6xl">
      <BlogPostForm
        post={postResult.data}
        categories={categoriesResult.data || []}
        tags={tagsResult.data || []}
      />
    </div>
  )
}
