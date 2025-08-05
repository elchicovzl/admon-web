import Link from 'next/link'
import { siteConfig } from '@/data/site-config'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-900 text-white" style={{ fontFamily: "Reckless, serif" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left side - Main content */}
          <div className="space-y-8">
            <div>
              <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
                Ayudando a marcas como la tuya a superar objetivos de conversión.
              </h2>
            </div>
            
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-400 rounded-lg flex items-center justify-center">
                <div className="w-6 h-6 text-gray-900">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
              </div>
              <span className="text-2xl font-bold">{siteConfig.name}</span>
            </div>
          </div>

          {/* Right side - Links and social */}
          <div className="flex flex-col space-y-8 lg:items-end">
            {/* Navigation Links */}
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-8 text-lg">
              <Link 
                href="#pricing" 
                className="text-gray-300 hover:text-white transition-colors"
              >
                Auditoría gratuita
              </Link>
              <Link 
                href="#services" 
                className="text-gray-300 hover:text-white transition-colors"
              >
                Diseño web CRO
              </Link>
              <Link 
                href="#contact" 
                className="text-gray-300 hover:text-white transition-colors"
              >
                Ponte en contacto
              </Link>
            </div>

            {/* Social Links */}
            <div className="flex space-x-4">
              {siteConfig.social.linkedin && (
                <a
                  href={siteConfig.social.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="LinkedIn"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
              )}
              <a
                href="https://twitter.com/adminisegura"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Twitter/X"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom section */}
        <div className="mt-12 pt-8 border-t border-gray-700">
          <div className="flex flex-col md:flex-row justify-between items-center text-gray-400 text-sm">
            <p>© {siteConfig.name} {currentYear} Una empresa doble makers</p>
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