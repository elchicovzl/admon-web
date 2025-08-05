export const SITE_URLS = {
  home: '/',
  pricing: '#pricing',
  benefits: '#benefits',
  testimonials: '#testimonials',
  process: '#process',
  cta: '#cta',
} as const

export const SOCIAL_LINKS = {
  linkedin: 'https://linkedin.com/company/administracion-segura',
  twitter: 'https://twitter.com/adminisegura',
} as const

export const CONTACT_INFO = {
  email: 'contacto@administracionsegura.com',
  phone: '+34 900 000 000',
} as const

export const SEO_DEFAULTS = {
  defaultTitle: 'Administración Segura - Auditorías CRO para E-commerce',
  titleTemplate: '%s | Administración Segura',
  defaultDescription: 'Aumenta tus conversiones con auditorías CRO profesionales. Identificamos puntos de fricción y creamos planes de acción personalizados para optimizar tu tienda online.',
  siteUrl: 'https://administracionsegura.com',
  defaultImage: '/images/og-image.jpg',
} as const

export const ANALYTICS = {
  gtag: process.env.NEXT_PUBLIC_GA_ID,
  hotjar: process.env.NEXT_PUBLIC_HOTJAR_ID,
} as const