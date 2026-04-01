import { getRelatedPosts } from '@/lib/actions/blog.actions'
import { BlogPostCard } from './blog-post-card'

interface BlogRelatedPostsProps {
  postId: string
  categoryId: string | null
}

export async function BlogRelatedPosts({ postId, categoryId }: BlogRelatedPostsProps) {
  const result = await getRelatedPosts(postId, categoryId, 3)
  const posts = result.data || []

  if (posts.length === 0) return null

  return (
    <section className="mt-12 border-t pt-8">
      <h2 className="mb-6 text-2xl font-bold">Artículos Relacionados</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <BlogPostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  )
}
