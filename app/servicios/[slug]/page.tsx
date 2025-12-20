import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Script from 'next/script'
import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import WhatsAppWidget from '@/components/ui/whatsapp-widget'
import {
  ServiceHero,
  ServiceAudience,
  ServiceFeatures,
  ServiceBenefits,
  ServiceTimeline,
  ServiceProcess,
  ServiceCTA,
  ServiceRelated
} from '@/components/services'
import { getServiceBySlug, servicePages } from '@/data/services'
import ContactSection from '@/components/sections/contact-section'

// Base URL for canonical and OG URLs
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://administracionsegura.com'

interface PageProps {
  params: Promise<{ slug: string }>
}

// Generate static params for all services
export async function generateStaticParams() {
  return servicePages.map((service) => ({
    slug: service.slug,
  }))
}

// Generate metadata for each service page (SEO optimized)
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const service = getServiceBySlug(slug)

  if (!service) {
    return {
      title: 'Servicio no encontrado | Administración Segura',
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const canonicalUrl = `${BASE_URL}/servicios/${slug}`

  return {
    // Basic metadata
    title: service.seo.title,
    description: service.seo.description,
    keywords: service.seo.keywords,

    // Canonical URL
    alternates: {
      canonical: canonicalUrl,
    },

    // Robots
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

    // Open Graph (Facebook, LinkedIn, etc.)
    openGraph: {
      title: service.seo.title,
      description: service.seo.description,
      url: canonicalUrl,
      siteName: 'Administración Segura',
      locale: 'es_CO',
      type: 'website',
      images: [
        {
          url: `${BASE_URL}/images/og-${slug}.jpg`,
          width: 1200,
          height: 630,
          alt: service.name,
        },
        {
          url: `${BASE_URL}/images/logoadmon2.webp`,
          width: 512,
          height: 512,
          alt: 'Administración Segura Logo',
        },
      ],
    },

    // Twitter Card
    twitter: {
      card: 'summary_large_image',
      title: service.seo.title,
      description: service.seo.description,
      images: [`${BASE_URL}/images/og-${slug}.jpg`],
      creator: '@AdminSegura',
      site: '@AdminSegura',
    },

    // Additional metadata
    authors: [{ name: 'Administración Segura' }],
    creator: 'Administración Segura',
    publisher: 'Administración Segura',
    category: 'Business Services',

    // Verification (add your actual verification codes)
    // verification: {
    //   google: 'your-google-verification-code',
    // },
  }
}

// JSON-LD Structured Data for the service
function generateServiceJsonLd(service: ReturnType<typeof getServiceBySlug>, slug: string) {
  if (!service) return null

  const canonicalUrl = `${BASE_URL}/servicios/${slug}`

  // Service Schema
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': canonicalUrl,
    name: service.name,
    description: service.fullDescription,
    url: canonicalUrl,
    provider: {
      '@type': 'Organization',
      name: 'Administración Segura',
      url: BASE_URL,
      logo: `${BASE_URL}/images/logoadmon2.webp`,
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'CO',
        addressLocality: 'Colombia',
      },
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        availableLanguage: ['Spanish'],
      },
    },
    areaServed: {
      '@type': 'Country',
      name: 'Colombia',
    },
    serviceType: service.name,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `Servicios de ${service.name}`,
      itemListElement: service.features.map((feature, index) => ({
        '@type': 'Offer',
        '@id': `${canonicalUrl}#feature-${index}`,
        name: feature.title,
        description: feature.description,
      })),
    },
  }

  // BreadcrumbList Schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Inicio',
        item: BASE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Servicios',
        item: `${BASE_URL}/#features`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: service.name,
        item: canonicalUrl,
      },
    ],
  }

  // FAQ Schema (if service has timeline or process, create FAQ from it)
  const faqItems = []

  if (service.timeline) {
    faqItems.push({
      '@type': 'Question',
      name: '¿Quién es responsable de pagar las incapacidades en cada etapa?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: service.timeline.map(t => `${t.period}: ${t.responsible} - ${t.description}`).join('. '),
      },
    })
  }

  if (service.benefits.length > 0) {
    faqItems.push({
      '@type': 'Question',
      name: `¿Cuáles son los beneficios de ${service.name}?`,
      acceptedAnswer: {
        '@type': 'Answer',
        text: service.benefits.map(b => `${b.title}: ${b.description}`).join('. '),
      },
    })
  }

  const faqSchema = faqItems.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems,
  } : null

  return { serviceSchema, breadcrumbSchema, faqSchema }
}

export default async function ServicePage({ params }: PageProps) {
  const { slug } = await params
  const service = getServiceBySlug(slug)

  if (!service) {
    notFound()
  }

  const jsonLd = generateServiceJsonLd(service, slug)

  return (
    <>
      {/* JSON-LD Structured Data */}
      {jsonLd && (
        <>
          <Script
            id={`service-schema-${slug}`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(jsonLd.serviceSchema),
            }}
          />
          <Script
            id={`breadcrumb-schema-${slug}`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(jsonLd.breadcrumbSchema),
            }}
          />
          {jsonLd.faqSchema && (
            <Script
              id={`faq-schema-${slug}`}
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify(jsonLd.faqSchema),
              }}
            />
          )}
        </>
      )}

      <div className="min-h-screen bg-white">
        <Header />

        <main>
          {/* Hero Section */}
          <ServiceHero service={service} />

          {/* Target Audience Section */}
          <ServiceAudience service={service} />

          {/* Features Section */}
          <ServiceFeatures service={service} />

          {/* Benefits Section */}
          <ServiceBenefits service={service} />

          {/* Timeline Section (only for recobro-incapacidades) */}
          {service.timeline && <ServiceTimeline service={service} />}

          {/* Process Section (if available) */}
          {service.process && <ServiceProcess service={service} />}

          {/* CTA Section */}
          <ServiceCTA service={service} />

          {/* Contact Section */}
          <ContactSection />

          {/* Related Services */}
          <ServiceRelated currentSlug={slug} />
        </main>

        <Footer />
        <WhatsAppWidget />
      </div>
    </>
  )
}
