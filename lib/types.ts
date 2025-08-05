export interface SiteConfig {
  name: string
  title: string
  description: string
  url: string
  keywords: string[]
  author: {
    name: string
    email: string
    url: string
  }
  social: {
    linkedin?: string
    twitter?: string
  }
}

export interface Testimonial {
  id: string
  name: string
  role: string
  company: string
  image: string
  content: string
  rating: number
}

export interface Feature {
  id: string
  title: string
  description: string
  icon: string
  image?: string
  stats?: {
    value: string
    label: string
  }
}

export interface ProcessStep {
  id: string
  step: number
  title: string
  description: string
  color: string
  backgroundColor: string
}

export interface PricingPlan {
  id: string
  name: string
  description: string
  price: {
    amount: number
    currency: string
    period: string
  }
  features: string[]
  highlighted?: boolean
  cta: {
    text: string
    href: string
  }
}

export interface NavigationItem {
  label: string
  href: string
  external?: boolean
}

export interface CTAButton {
  text: string
  href: string
  variant?: 'primary' | 'secondary' | 'outline'
  external?: boolean
}

export interface FAQItem {
  id: string
  question: string
  answer: string
  category?: string
}