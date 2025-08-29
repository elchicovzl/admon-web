import Link from 'next/link'
import Image from 'next/image'
import { siteConfig } from '@/data/site-config'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left side - Main content */}
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
                Tu tranquilidad en seguridad social es nuestro compromiso.
              </h2>
            </div>
            
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                <Image
                  src="/images/logo.png"
                  alt="Administración Segura Logo"
                  width={32}
                  height={32}
                  className="w-8 h-8 object-contain"
                />
              </div>
              <span className="text-xl md:text-2xl font-bold font-serif">ADMINISTRACIÓN <span className="text-orange-400 font-serif">SEGURA</span></span>
            </div>
          </div>

          {/* Right side - Links and social */}
          <div className="flex flex-col space-y-8 lg:items-end">
            {/* Navigation Links */}
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-8 text-lg">
              <Link 
                href="#servicios" 
                className="text-gray-300 hover:text-white transition-colors"
              >
                Nuestros Servicios
              </Link>
              <Link 
                href="#proceso" 
                className="text-gray-300 hover:text-white transition-colors"
              >
                Cómo Trabajamos
              </Link>
              <Link 
                href="#contacto" 
                className="text-gray-300 hover:text-white transition-colors"
              >
                Contacto
              </Link>
            </div>

            {/* Social Links */}
            <div className="flex space-x-4">
              <a
                href="https://facebook.com/adminisegura"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Facebook"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a
                href="https://instagram.com/adminisegura"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Instagram"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom section */}
        <div className="mt-12 pt-8 border-t border-gray-700">
          <div className="flex flex-col md:flex-row justify-between items-center text-gray-400 text-sm">
            <p>© <span className="font-serif">ADMINISTRACIÓN <span className="text-orange-400 font-serif">SEGURA</span></span> {currentYear} Una empresa doble makers</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link 
                href="/privacy" 
                className="hover:text-white transition-colors"
              >
                Política de Privacidad
              </Link>
              <Link 
                href="/terms" 
                className="hover:text-white transition-colors"
              >
                Términos de Servicio
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}