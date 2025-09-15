'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'
import { useSmoothScroll } from '@/hooks/use-smooth-scroll'

const navigation = [
  { label: 'Beneficios', href: '#benefits' },
  { label: 'Testimonios', href: '#testimonials' },
  { label: 'Cotizador', href: '#features' },
  { label: 'Cómo funciona', href: '#process' },
  { label: 'Nosotros', href: '#nosotros' },
]

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { scrollToSection } = useSmoothScroll()

  const handleNavClick = (href: string) => {
    const sectionId = href.replace('#', '')
    scrollToSection(sectionId)
  }

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-3">
              <Image
                src="/images/logo.png"
                alt="Administración Segura Logo"
                width={80}
                height={80}
                className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
                priority
              />
              <span className="text-xl font-bold text-gray-900 font-serif">
                ADMINISTRACIÓN <span className="text-orange-400 font-serif">SEGURA</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navigation.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNavClick(item.href)}
                className="nav-item text-gray-700 hover:text-gray-900 font-medium transition-colors relative px-4 py-2 flex items-center justify-center text-sm"
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* CTA Button */}
          <div className="hidden md:block">
            <Button
              className="bg-black text-white hover:bg-gray-800 rounded-full px-6 text-sm"
              onClick={() => handleNavClick('#contacto')}
            >
              Contáctanos
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
                <button
                  key={item.label}
                  onClick={() => {
                    handleNavClick(item.href)
                    setMobileMenuOpen(false)
                  }}
                  className="text-gray-700 hover:text-orange-500 font-medium transition-colors px-4 py-2 rounded hover:bg-orange-50 text-left"
                >
                  {item.label}
                </button>
              ))}
              <Button
                className="bg-black text-white hover:bg-gray-800 rounded-full w-full mt-4"
                onClick={() => {
                  handleNavClick('#contacto')
                  setMobileMenuOpen(false)
                }}
              >
                Contáctanos
              </Button>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}