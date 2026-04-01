import { BlogPostStatus } from '@prisma/client'

export interface SafeBlogCategory {
  id: string
  name: string
  slug: string
  description: string | null
  isActive: boolean
  _count?: {
    posts: number
  }
}

export interface SafeBlogTag {
  id: string
  name: string
  slug: string
}

export interface SafeBlogPost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  status: BlogPostStatus
  featuredImageUrl: string | null
  publishedAt: Date | null
  readingTime: number | null
  createdAt: Date
  updatedAt: Date
  author: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
  category: {
    id: string
    name: string
    slug: string
  } | null
  tags: SafeBlogTag[]
}

export interface BlogPostWithRelations extends SafeBlogPost {
  content: string
  featuredImageS3Key: string | null
  metaTitle: string | null
  metaDescription: string | null
  keywords: string | null
  ogImageUrl: string | null
  ogImageS3Key: string | null
  isActive: boolean
}

export interface PublishedBlogPostsResponse {
  posts: SafeBlogPost[]
  total: number
  totalPages: number
  currentPage: number
}

export interface DashboardBlogPostsResponse {
  posts: SafeBlogPost[]
  totalCount: number
  totalPages: number
  currentPage: number
}

export interface GetBlogPostsParams {
  page?: number
  pageSize?: number
  search?: string
  status?: string
}
