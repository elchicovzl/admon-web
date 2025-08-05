import { Metadata } from 'next'
import { SiteConfig } from './types'

export function generateMetadata(
  title: string,
  description: string,
  path: string = '',
  image?: string
): Metadata {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://administracionsegura.com'
  const fullUrl = `${siteUrl}${path}`
  const defaultImage = `${siteUrl}/images/og-image.jpg`

  return {
    title,
    description,
    keywords: [
      'conversión',
      'CRO',
      'optimización',
      'e-commerce',
      'auditoría web',
      'UX',
      'diseño web',
      'marketing digital'
    ],
    authors: [{ name: 'Administración Segura' }],
    creator: 'Administración Segura',
    publisher: 'Administración Segura',
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: fullUrl,
    },
    openGraph: {
      type: 'website',
      locale: 'es_ES',
      url: fullUrl,
      title,
      description,
      siteName: 'Administración Segura',
      images: [
        {
          url: image || defaultImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image || defaultImage],
      creator: '@administracionsegura',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }
}

export function generateStructuredData(config: SiteConfig) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: config.name,
    url: config.url,
    description: config.description,
    founder: {
      '@type': 'Person',
      name: config.author.name,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      email: config.author.email,
      contactType: 'customer service',
    },
    sameAs: Object.values(config.social).filter(Boolean),
    service: {
      '@type': 'Service',
      name: 'Auditoría CRO',
      description: 'Servicio de optimización de conversiones para e-commerce',
      provider: {
        '@type': 'Organization',
        name: config.name,
      },
    },
  }
}