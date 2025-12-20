'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Menu, X, ChevronDown, Shield, FileText, Heart, Car, Stethoscope, Umbrella, PawPrint, Building2, Package } from 'lucide-react'
import { useSmoothScroll } from '@/hooks/use-smooth-scroll'
import { cn } from '@/lib/utils'

// Service menu items
const mainServices = [
  {
    title: 'Afiliaciones a Seguridad Social',
    href: '/servicios/afiliaciones-seguridad-social',
    description: 'Para Empresas e Independientes',
    icon: Shield,
    color: 'text-blue-500'
  },
  {
    title: 'Gestión y Liquidación PILA',
    href: '/servicios/gestion-pila',
    description: 'Ahorre tiempo y evite sanciones',
    icon: FileText,
    color: 'text-green-500'
  },
  {
    title: 'Recobro de Incapacidades',
    href: '/servicios/recobro-incapacidades',
    description: 'Recupere sus pagos ante EPS, ARL y Fondos',
    icon: Heart,
    color: 'text-purple-500'
  },
]

const insuranceServices = [
  { title: 'Seguro de Vehículos', href: '/servicios/seguros-vehiculos', icon: Car },
  { title: 'Seguros de Salud', href: '/servicios/seguros-salud', icon: Stethoscope },
  { title: 'Seguros de Vida', href: '/servicios/seguros-vida', icon: Umbrella },
  { title: 'Seguro para Mascotas', href: '/servicios/seguros-mascotas', icon: PawPrint },
  { title: 'Seguros para Empresas', href: '/servicios/seguros-empresas', icon: Building2 },
  { title: 'Otros Productos', href: '/servicios/seguros-otros', icon: Package },
]

const navigation = [
  { label: 'Beneficios', href: '#benefits' },
  { label: 'Testimonios', href: '#testimonials' },
  { label: 'Cómo funciona', href: '#process' },
  { label: 'Nosotros', href: '#nosotros' },
]

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [servicesOpen, setServicesOpen] = useState(false)
  const [insuranceOpen, setInsuranceOpen] = useState(false)
  const { scrollToSection } = useSmoothScroll()

  const handleNavClick = (href: string) => {
    const sectionId = href.replace('#', '')
    scrollToSection(sectionId)
    setMobileMenuOpen(false)
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
          <nav className="hidden lg:flex items-center space-x-1">
            {/* Services Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="nav-item text-gray-700 hover:text-gray-900 font-medium transition-colors relative px-4 py-2 flex items-center justify-center text-sm">
                  Servicios
                  <ChevronDown className="ml-1 h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[480px] p-4">
                {/* Main Services */}
                <DropdownMenuLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Servicios Principales
                </DropdownMenuLabel>
                {mainServices.map((service) => (
                  <DropdownMenuItem key={service.href} asChild>
                    <Link
                      href={service.href}
                      className="flex items-start gap-3 p-3 rounded-lg cursor-pointer"
                    >
                      <div className={`p-2 rounded-lg bg-gray-100 ${service.color}`}>
                        <service.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{service.title}</div>
                        <p className="text-sm text-gray-500">{service.description}</p>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator className="my-3" />

                {/* Insurance Services */}
                <DropdownMenuLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Seguros
                </DropdownMenuLabel>
                <div className="grid grid-cols-2 gap-1">
                  {insuranceServices.map((service) => (
                    <DropdownMenuItem key={service.href} asChild>
                      <Link
                        href={service.href}
                        className="flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm"
                      >
                        <service.icon className="w-4 h-4 text-amber-500" />
                        <span className="text-gray-700">{service.title}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Other nav items */}
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
          <div className="hidden lg:block">
            <Button
              className="bg-black text-white hover:bg-gray-800 rounded-full px-6 text-sm"
              onClick={() => handleNavClick('#contacto')}
            >
              Contáctanos
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden">
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
          <div className="lg:hidden py-4 border-t border-gray-200">
            <nav className="flex flex-col space-y-2">
              {/* Services Collapsible */}
              <Collapsible open={servicesOpen} onOpenChange={setServicesOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full text-gray-700 hover:text-orange-500 font-medium transition-colors px-4 py-3 rounded hover:bg-orange-50">
                  <span>Servicios</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", servicesOpen && "rotate-180")} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4 space-y-1 mt-2">
                  {/* Main Services */}
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2">
                    Principales
                  </p>
                  {mainServices.map((service) => (
                    <Link
                      key={service.href}
                      href={service.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded"
                    >
                      <service.icon className={cn("w-4 h-4", service.color)} />
                      <span className="text-sm">{service.title}</span>
                    </Link>
                  ))}

                  {/* Insurance Collapsible */}
                  <Collapsible open={insuranceOpen} onOpenChange={setInsuranceOpen}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full text-gray-600 hover:text-orange-500 font-medium transition-colors px-4 py-2 rounded hover:bg-orange-50">
                      <span className="text-sm">Seguros</span>
                      <ChevronDown className={cn("h-3 w-3 transition-transform", insuranceOpen && "rotate-180")} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-4 space-y-1 mt-1">
                      {insuranceServices.map((service) => (
                        <Link
                          key={service.href}
                          href={service.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-amber-50 rounded text-sm"
                        >
                          <service.icon className="w-4 h-4 text-amber-500" />
                          <span>{service.title}</span>
                        </Link>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                </CollapsibleContent>
              </Collapsible>

              {/* Other nav items */}
              {navigation.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleNavClick(item.href)}
                  className="text-gray-700 hover:text-orange-500 font-medium transition-colors px-4 py-3 rounded hover:bg-orange-50 text-left"
                >
                  {item.label}
                </button>
              ))}

              <Button
                className="bg-black text-white hover:bg-gray-800 rounded-full w-full mt-4"
                onClick={() => handleNavClick('#contacto')}
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
