'use server'

import { cache } from 'react'
import { auth } from '@/lib/auth/auth'
import prisma from '@/lib/db/prisma'
import { UserRole, BlogPostStatus } from '@prisma/client'
import sanitizeHtml from 'sanitize-html'
import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import {
  createBlogPostSchema,
  updateBlogPostSchema,
  createBlogCategorySchema,
  createBlogTagSchema,
  type CreateBlogPostInput,
  type UpdateBlogPostInput,
  type CreateBlogCategoryInput,
  type CreateBlogTagInput,
} from '@/lib/validations/blog.schema'
import type {
  SafeBlogPost,
  BlogPostWithRelations,
  SafeBlogCategory,
  SafeBlogTag,
  PublishedBlogPostsResponse,
  DashboardBlogPostsResponse,
  GetBlogPostsParams,
} from '@/lib/types/blog.types'
import type { ActionResponse } from '@/lib/types/auth.types'
import { revalidatePath } from 'next/cache'

// ============================================
// Helpers
// ============================================

async function requireManagerOrAdmin() {
  const session = await auth()

  if (!session?.user) {
    return { authorized: false as const, error: 'No autenticado' }
  }

  if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.MANAGER) {
    return { authorized: false as const, error: 'No tienes permisos para esta acción' }
  }

  return { authorized: true as const, userId: session.user.id }
}

// Allowed tags for blog content — standard HTML content + images
const SANITIZE_CONFIG: sanitizeHtml.IOptions = {
  allowedTags: [
    'a', 'b', 'blockquote', 'br', 'caption', 'cite', 'code', 'col', 'colgroup',
    'dd', 'del', 'details', 'dfn', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'kbd',
    'li', 'main', 'mark', 'ol', 'p', 'pre', 'q', 's', 'samp', 'section',
    'small', 'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td',
    'tfoot', 'th', 'thead', 'time', 'tr', 'u', 'ul', 'var',
  ],
  allowedAttributes: {
    '*': ['class', 'id', 'style', 'title'],
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
    col: ['colspan'],
    time: ['datetime'],
  },
}

function sanitizeContent(html: string): string {
  return sanitizeHtml(html, SANITIZE_CONFIG)
}

// ============================================
// R2 Helpers
// ============================================

function getR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) return null

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

/**
 * Move a temp R2 object to the post's permanent path.
 * Returns the new key (or the original if no move needed/possible).
 */
async function migrateR2Key(tempKey: string, postId: string): Promise<string> {
  if (!tempKey.includes('blog/temp/')) return tempKey

  const bucket = process.env.R2_BUCKET_NAME
  const r2 = getR2Client()
  if (!r2 || !bucket) return tempKey

  const fileName = tempKey.split('/').pop() || tempKey
  const newKey = `blog/${postId}/${fileName}`

  try {
    await r2.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${tempKey}`,
        Key: newKey,
      }),
    )
    await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: tempKey }))
    return newKey
  } catch (err) {
    console.error('R2 migrate key error:', err)
    return tempKey
  }
}

function calculateReadingTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, '')
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

const blogPostSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  status: true,
  featuredImageUrl: true,
  publishedAt: true,
  readingTime: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  tags: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
}

const blogPostFullSelect = {
  ...blogPostSelect,
  content: true,
  featuredImageS3Key: true,
  metaTitle: true,
  metaDescription: true,
  keywords: true,
  ogImageUrl: true,
  ogImageS3Key: true,
  isActive: true,
}

// ============================================
// Blog Post Actions
// ============================================

/**
 * Get blog posts (dashboard) with server-side pagination, search, and status filter
 */
export const getBlogPosts = cache(async (
  params: GetBlogPostsParams = {},
): Promise<ActionResponse<DashboardBlogPostsResponse>> => {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const { page = 1, pageSize = 20, search, status } = params

    const where: Record<string, unknown> = { isActive: true }
    if (status && status !== 'ALL') where.status = status
    if (search?.trim()) {
      where.title = { contains: search.trim(), mode: 'insensitive' }
    }

    const [posts, totalCount] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        select: blogPostSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.blogPost.count({ where }),
    ])

    return {
      success: true,
      data: {
        posts,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        currentPage: page,
      },
    }
  } catch (error) {
    console.error('Get blog posts error:', error)
    return { success: false, error: 'Error al obtener posts' }
  }
})

/**
 * Get blog post by ID (for editing)
 */
export const getBlogPostById = cache(async (id: string): Promise<ActionResponse<BlogPostWithRelations>> => {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const post = await prisma.blogPost.findUnique({
      where: { id },
      select: blogPostFullSelect,
    })

    if (!post) {
      return { success: false, error: 'Post no encontrado' }
    }

    return { success: true, data: post as BlogPostWithRelations }
  } catch (error) {
    console.error('Get blog post by id error:', error)
    return { success: false, error: 'Error al obtener post' }
  }
})

/**
 * Get blog post by ID for preview (auth required — MANAGER or SUPER_ADMIN)
 */
export const getBlogPostForPreview = cache(async (id: string): Promise<ActionResponse<BlogPostWithRelations>> => {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const post = await prisma.blogPost.findUnique({
      where: { id },
      select: blogPostFullSelect,
    })

    if (!post) {
      return { success: false, error: 'Post no encontrado' }
    }

    return { success: true, data: post as BlogPostWithRelations }
  } catch (error) {
    console.error('Get blog post for preview error:', error)
    return { success: false, error: 'Error al obtener post' }
  }
})

/**
 * Get blog post by slug (public page)
 */
export const getBlogPostBySlug = cache(async (slug: string): Promise<ActionResponse<BlogPostWithRelations>> => {
  try {
    const post = await prisma.blogPost.findUnique({
      where: { slug, status: 'PUBLISHED', isActive: true },
      select: blogPostFullSelect,
    })

    if (!post) {
      return { success: false, error: 'Post no encontrado' }
    }

    return { success: true, data: post as BlogPostWithRelations }
  } catch (error) {
    console.error('Get blog post by slug error:', error)
    return { success: false, error: 'Error al obtener post' }
  }
})

/**
 * Get published blog posts (public, paginated)
 */
export const getPublishedBlogPosts = cache(async (
  page: number = 1,
  pageSize: number = 9,
  categorySlug?: string,
): Promise<ActionResponse<PublishedBlogPostsResponse>> => {
  try {
    const where: Record<string, unknown> = {
      status: 'PUBLISHED',
      isActive: true,
    }

    if (categorySlug) {
      where.category = { slug: categorySlug }
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        select: blogPostSelect,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.blogPost.count({ where }),
    ])

    return {
      success: true,
      data: {
        posts,
        total,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      },
    }
  } catch (error) {
    console.error('Get published blog posts error:', error)
    return { success: false, error: 'Error al obtener posts' }
  }
})

/**
 * Get blog posts count by status
 */
export const getBlogPostsCount = cache(async (): Promise<ActionResponse<{
  total: number
  published: number
  draft: number
  archived: number
}>> => {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const [total, published, draft, archived] = await Promise.all([
      prisma.blogPost.count({ where: { isActive: true } }),
      prisma.blogPost.count({ where: { isActive: true, status: 'PUBLISHED' } }),
      prisma.blogPost.count({ where: { isActive: true, status: 'DRAFT' } }),
      prisma.blogPost.count({ where: { isActive: true, status: 'ARCHIVED' } }),
    ])

    return { success: true, data: { total, published, draft, archived } }
  } catch (error) {
    console.error('Get blog posts count error:', error)
    return { success: false, error: 'Error al obtener conteos' }
  }
})

/**
 * Create blog post
 */
export async function createBlogPost(data: CreateBlogPostInput): Promise<ActionResponse<SafeBlogPost>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const validated = createBlogPostSchema.parse(data)

    // Check slug uniqueness among active posts only (soft-deleted posts don't block reuse)
    const existing = await prisma.blogPost.findFirst({ where: { slug: validated.slug, isActive: true } })
    if (existing) {
      return { success: false, error: 'Ya existe un post con ese slug' }
    }

    const sanitizedContent = sanitizeContent(validated.content)
    const readingTime = calculateReadingTime(sanitizedContent)
    const publishedAt = validated.status === 'PUBLISHED' ? new Date() : null

    const post = await prisma.blogPost.create({
      data: {
        title: validated.title,
        slug: validated.slug,
        excerpt: validated.excerpt || null,
        content: sanitizedContent,
        status: validated.status,
        featuredImageUrl: validated.featuredImageUrl || null,
        featuredImageS3Key: validated.featuredImageS3Key || null,
        metaTitle: validated.metaTitle || null,
        metaDescription: validated.metaDescription || null,
        keywords: validated.keywords || null,
        ogImageUrl: validated.ogImageUrl || null,
        ogImageS3Key: validated.ogImageS3Key || null,
        readingTime,
        publishedAt,
        authorId: authCheck.userId,
        categoryId: validated.categoryId || null,
        tags: validated.tagIds?.length
          ? { connect: validated.tagIds.map((id) => ({ id })) }
          : undefined,
      },
      select: blogPostSelect,
    })

    // Migrate temp R2 images to permanent post path
    const featuredKey = validated.featuredImageS3Key || null
    const ogKey = validated.ogImageS3Key || null
    const updates: Record<string, string | null> = {}

    if (featuredKey?.includes('blog/temp/')) {
      const newKey = await migrateR2Key(featuredKey, post.id)
      updates.featuredImageS3Key = newKey
      updates.featuredImageUrl = `/api/blog-image?key=${encodeURIComponent(newKey)}`
    }
    if (ogKey?.includes('blog/temp/')) {
      const newKey = await migrateR2Key(ogKey, post.id)
      updates.ogImageS3Key = newKey
      updates.ogImageUrl = `/api/blog-image?key=${encodeURIComponent(newKey)}`
    }

    let finalPost = post
    if (Object.keys(updates).length > 0) {
      finalPost = await prisma.blogPost.update({
        where: { id: post.id },
        data: updates,
        select: blogPostSelect,
      })
    }

    revalidatePath('/dashboard/blog')
    revalidatePath('/blog')
    revalidatePath('/sitemap.xml')

    return { success: true, data: finalPost, message: 'Post creado exitosamente' }
  } catch (error) {
    console.error('Create blog post error:', error)
    return { success: false, error: 'Error al crear post' }
  }
}

/**
 * Update blog post
 */
export async function updateBlogPost(data: UpdateBlogPostInput): Promise<ActionResponse<SafeBlogPost>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const validated = updateBlogPostSchema.parse(data)

    // Check slug uniqueness among active posts only, excluding current post
    const existing = await prisma.blogPost.findFirst({
      where: { slug: validated.slug, isActive: true, id: { not: validated.id } },
    })
    if (existing) {
      return { success: false, error: 'Ya existe un post con ese slug' }
    }

    // Get current post to handle publishedAt transitions
    const currentPost = await prisma.blogPost.findUnique({
      where: { id: validated.id },
      select: { status: true, publishedAt: true },
    })

    if (!currentPost) {
      return { success: false, error: 'Post no encontrado' }
    }

    const sanitizedContent = sanitizeContent(validated.content)
    const readingTime = calculateReadingTime(sanitizedContent)

    // Set publishedAt on first publish
    let publishedAt = currentPost.publishedAt
    if (validated.status === 'PUBLISHED' && !currentPost.publishedAt) {
      publishedAt = new Date()
    }

    const post = await prisma.blogPost.update({
      where: { id: validated.id },
      data: {
        title: validated.title,
        slug: validated.slug,
        excerpt: validated.excerpt || null,
        content: sanitizedContent,
        status: validated.status,
        featuredImageUrl: validated.featuredImageUrl || null,
        featuredImageS3Key: validated.featuredImageS3Key || null,
        metaTitle: validated.metaTitle || null,
        metaDescription: validated.metaDescription || null,
        keywords: validated.keywords || null,
        ogImageUrl: validated.ogImageUrl || null,
        ogImageS3Key: validated.ogImageS3Key || null,
        readingTime,
        publishedAt,
        categoryId: validated.categoryId || null,
        tags: {
          set: validated.tagIds?.map((id) => ({ id })) ?? [],
        },
      },
      select: blogPostSelect,
    })

    revalidatePath('/dashboard/blog')
    revalidatePath('/blog')
    revalidatePath(`/blog/${post.slug}`)
    revalidatePath('/sitemap.xml')

    return { success: true, data: post, message: 'Post actualizado exitosamente' }
  } catch (error) {
    console.error('Update blog post error:', error)
    return { success: false, error: 'Error al actualizar post' }
  }
}

/**
 * Delete blog post (soft delete)
 */
export async function deleteBlogPost(id: string): Promise<ActionResponse<void>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    await prisma.blogPost.update({
      where: { id },
      data: { isActive: false },
    })

    revalidatePath('/dashboard/blog')
    revalidatePath('/blog')
    revalidatePath('/sitemap.xml')

    return { success: true, message: 'Post eliminado exitosamente' }
  } catch (error) {
    console.error('Delete blog post error:', error)
    return { success: false, error: 'Error al eliminar post' }
  }
}

/**
 * Toggle blog post status
 */
export async function toggleBlogPostStatus(
  id: string,
  status: BlogPostStatus,
): Promise<ActionResponse<SafeBlogPost>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const currentPost = await prisma.blogPost.findUnique({
      where: { id },
      select: { publishedAt: true },
    })

    if (!currentPost) {
      return { success: false, error: 'Post no encontrado' }
    }

    const updateData: Record<string, unknown> = { status }

    // Set publishedAt on first publish
    if (status === 'PUBLISHED' && !currentPost.publishedAt) {
      updateData.publishedAt = new Date()
    }

    const post = await prisma.blogPost.update({
      where: { id },
      data: updateData,
      select: blogPostSelect,
    })

    revalidatePath('/dashboard/blog')
    revalidatePath('/blog')
    revalidatePath(`/blog/${post.slug}`)
    revalidatePath('/sitemap.xml')

    return { success: true, data: post, message: 'Estado actualizado' }
  } catch (error) {
    console.error('Toggle blog post status error:', error)
    return { success: false, error: 'Error al cambiar estado' }
  }
}

/**
 * Get all published slugs (for generateStaticParams)
 */
export const getAllPublishedSlugs = cache(async (): Promise<ActionResponse<string[]>> => {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { status: 'PUBLISHED', isActive: true },
      select: { slug: true },
    })

    return { success: true, data: posts.map((p) => p.slug) }
  } catch (error) {
    console.error('Get all published slugs error:', error)
    return { success: false, error: 'Error al obtener slugs' }
  }
})

/**
 * Get related posts (same category, different post)
 */
export const getRelatedPosts = cache(async (
  postId: string,
  categoryId: string | null,
  limit: number = 3,
): Promise<ActionResponse<SafeBlogPost[]>> => {
  try {
    const where: Record<string, unknown> = {
      status: 'PUBLISHED',
      isActive: true,
      id: { not: postId },
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    const posts = await prisma.blogPost.findMany({
      where,
      select: blogPostSelect,
      orderBy: { publishedAt: 'desc' },
      take: limit,
    })

    return { success: true, data: posts }
  } catch (error) {
    console.error('Get related posts error:', error)
    return { success: false, error: 'Error al obtener posts relacionados' }
  }
})

// ============================================
// Blog Category Actions
// ============================================

/**
 * Get all blog categories
 */
export const getBlogCategories = cache(async (): Promise<ActionResponse<SafeBlogCategory[]>> => {
  try {
    const categories = await prisma.blogCategory.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { posts: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    return { success: true, data: categories }
  } catch (error) {
    console.error('Get blog categories error:', error)
    return { success: false, error: 'Error al obtener categorías' }
  }
})

/**
 * Create blog category
 */
export async function createBlogCategory(data: CreateBlogCategoryInput): Promise<ActionResponse<SafeBlogCategory>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const validated = createBlogCategorySchema.parse(data)

    const existing = await prisma.blogCategory.findUnique({ where: { slug: validated.slug } })
    if (existing) {
      return { success: false, error: 'Ya existe una categoría con ese slug' }
    }

    const category = await prisma.blogCategory.create({
      data: {
        name: validated.name,
        slug: validated.slug,
        description: validated.description || null,
      },
      include: {
        _count: {
          select: { posts: true },
        },
      },
    })

    revalidatePath('/dashboard/blog')

    return { success: true, data: category, message: 'Categoría creada exitosamente' }
  } catch (error) {
    console.error('Create blog category error:', error)
    return { success: false, error: 'Error al crear categoría' }
  }
}

/**
 * Update blog category
 */
export async function updateBlogCategory(
  id: string,
  data: CreateBlogCategoryInput,
): Promise<ActionResponse<SafeBlogCategory>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const validated = createBlogCategorySchema.parse(data)

    // Check slug uniqueness excluding current
    const existing = await prisma.blogCategory.findFirst({
      where: { slug: validated.slug, id: { not: id } },
    })
    if (existing) {
      return { success: false, error: 'Ya existe una categoría con ese slug' }
    }

    const category = await prisma.blogCategory.update({
      where: { id },
      data: {
        name: validated.name,
        slug: validated.slug,
        description: validated.description || null,
      },
      include: { _count: { select: { posts: true } } },
    })

    revalidatePath('/dashboard/blog')
    revalidatePath('/blog')

    return { success: true, data: category, message: 'Categoría actualizada' }
  } catch (error) {
    console.error('Update blog category error:', error)
    return { success: false, error: 'Error al actualizar categoría' }
  }
}

/**
 * Delete (soft-delete) blog category
 */
export async function deleteBlogCategory(id: string): Promise<ActionResponse<void>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Check if category has active posts
    const postCount = await prisma.blogPost.count({
      where: { categoryId: id, isActive: true },
    })
    if (postCount > 0) {
      return {
        success: false,
        error: `No se puede eliminar: la categoría tiene ${postCount} post${postCount > 1 ? 's' : ''} activo${postCount > 1 ? 's' : ''}`,
      }
    }

    await prisma.blogCategory.update({
      where: { id },
      data: { isActive: false },
    })

    revalidatePath('/dashboard/blog')
    revalidatePath('/blog')

    return { success: true, message: 'Categoría eliminada' }
  } catch (error) {
    console.error('Delete blog category error:', error)
    return { success: false, error: 'Error al eliminar categoría' }
  }
}

// ============================================
// Blog Tag Actions
// ============================================

/**
 * Get all blog tags
 */
export const getBlogTags = cache(async (): Promise<ActionResponse<SafeBlogTag[]>> => {
  try {
    const tags = await prisma.blogTag.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    })

    return { success: true, data: tags }
  } catch (error) {
    console.error('Get blog tags error:', error)
    return { success: false, error: 'Error al obtener tags' }
  }
})

/**
 * Update blog tag
 */
export async function updateBlogTag(id: string, name: string): Promise<ActionResponse<SafeBlogTag>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const slug = generateSlug(name.trim())
    const existing = await prisma.blogTag.findFirst({ where: { slug, id: { not: id } } })
    if (existing) {
      return { success: false, error: 'Ya existe un tag con ese nombre' }
    }

    const tag = await prisma.blogTag.update({
      where: { id },
      data: { name: name.trim(), slug },
      select: { id: true, name: true, slug: true },
    })

    revalidatePath('/dashboard/blog')

    return { success: true, data: tag, message: 'Tag actualizado' }
  } catch (error) {
    console.error('Update blog tag error:', error)
    return { success: false, error: 'Error al actualizar tag' }
  }
}

/**
 * Delete blog tag (hard delete — disconnects from all posts first)
 */
export async function deleteBlogTag(id: string): Promise<ActionResponse<void>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    await prisma.blogTag.delete({ where: { id } })

    revalidatePath('/dashboard/blog')

    return { success: true, message: 'Tag eliminado' }
  } catch (error) {
    console.error('Delete blog tag error:', error)
    return { success: false, error: 'Error al eliminar tag' }
  }
}

/**
 * Create blog tag
 */
export async function createBlogTag(data: CreateBlogTagInput): Promise<ActionResponse<SafeBlogTag>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const validated = createBlogTagSchema.parse(data)
    const slug = generateSlug(validated.name)

    const existing = await prisma.blogTag.findUnique({ where: { slug } })
    if (existing) {
      return { success: false, error: 'Ya existe un tag con ese nombre' }
    }

    const tag = await prisma.blogTag.create({
      data: {
        name: validated.name,
        slug,
      },
      select: { id: true, name: true, slug: true },
    })

    return { success: true, data: tag, message: 'Tag creado exitosamente' }
  } catch (error) {
    console.error('Create blog tag error:', error)
    return { success: false, error: 'Error al crear tag' }
  }
}
