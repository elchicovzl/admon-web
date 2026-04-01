import { MetadataRoute } from 'next'
import { servicePages } from '@/data/services'
import prisma from '@/lib/db/prisma'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://administracionsegura.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]

  // Dynamic service pages
  const servicePagesSitemap: MetadataRoute.Sitemap = servicePages.map((service) => ({
    url: `${BASE_URL}/servicios/${service.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  // Blog posts
  const blogPosts = await prisma.blogPost.findMany({
    where: { status: 'PUBLISHED', isActive: true },
    select: { slug: true, updatedAt: true },
  })

  const blogPostsSitemap: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  return [...staticPages, ...servicePagesSitemap, ...blogPostsSitemap]
}
