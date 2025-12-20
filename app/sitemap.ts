import { MetadataRoute } from 'next'
import { servicePages } from '@/data/services'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://administracionsegura.com'

export default function sitemap(): MetadataRoute.Sitemap {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
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

  return [...staticPages, ...servicePagesSitemap]
}
