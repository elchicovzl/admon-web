import { getBlogCategories, getBlogTags } from '@/lib/actions/blog.actions'
import { BlogPostForm } from '@/components/dashboard/blog/blog-post-form'

export const metadata = {
  title: 'Crear Post | Blog | Dashboard',
}

export default async function CreateBlogPostPage() {
  const [categoriesResult, tagsResult] = await Promise.all([
    getBlogCategories(),
    getBlogTags(),
  ])

  return (
    <div className="mx-auto max-w-6xl">
      <BlogPostForm
        categories={categoriesResult.data || []}
        tags={tagsResult.data || []}
      />
    </div>
  )
}
