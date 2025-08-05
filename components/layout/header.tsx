'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'
import { siteConfig } from '@/data/site-config'

const navigation = [
  { label: 'Beneficios', href: '#benefits' },
  { label: 'Testimonios', href: '#testimonials' },
  { label: 'Qué incluye', href: '#features' },
  { label: 'Cómo funciona', href: '#process' },
  { label: 'Precios', href: '#pricing' },
]

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-50" style={{ fontFamily: "Reckless, serif" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-gray-900">
              {siteConfig.name}
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navigation.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* CTA Button */}
          <div className="hidden md:block">
            <Button 
              className="bg-black text-white hover:bg-gray-800 rounded-full px-6"
              asChild
            >
              <Link href="#cta">Auditoría GRATIS</Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <nav className="flex flex-col space-y-4">
              {navigation.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <Button 
                className="bg-black text-white hover:bg-gray-800 rounded-full w-full mt-4"
                asChild
              >
                <Link href="#cta" onClick={() => setMobileMenuOpen(false)}>
                  Auditoría GRATIS
                </Link>
              </Button>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}