'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ControlledMenu, MenuItem, SubMenu, useHover, useMenuState } from '@szhsin/react-menu'
import '@szhsin/react-menu/dist/index.css'
import '@szhsin/react-menu/dist/transitions/slide.css'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Menu as MenuIcon, X, ChevronDown, Shield, FileText, Heart, Car, Stethoscope, Umbrella, PawPrint, Building2, Package } from 'lucide-react'
import { useSmoothScroll } from '@/hooks/use-smooth-scroll'
import { cn } from '@/lib/utils'
import { getSession } from '@/lib/actions/auth.actions'

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
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const { scrollToSection } = useSmoothScroll()
  const pathname = usePathname()

  useEffect(() => {
    getSession().then((session) => {
      setIsAuthenticated(!!session?.user)
    })
  }, [])

  // Hover menu state
  const menuRef = useRef<HTMLButtonElement>(null!)
  const [menuState, toggleMenu] = useMenuState({ transition: true })
  const { anchorProps, hoverProps } = useHover(menuState.state, toggleMenu)

  const handleNavClick = (href: string) => {
    if (pathname !== '/') {
      window.location.href = '/' + href
    } else {
      const sectionId = href.replace('#', '')
      scrollToSection(sectionId)
    }
    setMobileMenuOpen(false)
  }

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <Link href="/" className="flex items-center space-x-2">
              <Image
                src="/images/logoadmon2.webp"
                alt="Administración Segura Logo"
                width={80}
                height={80}
                className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
                priority
              />
              <span className="text-xl text-gray-900" style={{ fontFamily: 'Anton, sans-serif' }}>
                ADMINISTRACIÓN
              </span>
              <span className="bg-[#F1AD32] text-white px-1 py-0.5 font-bold text-xs">SEGURA</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1">
            {/* Services Dropdown with hover */}
            <button
              ref={menuRef}
              className="nav-item text-gray-700 hover:text-gray-900 font-medium transition-colors relative px-4 py-2 flex items-center justify-center text-sm cursor-pointer"
              {...anchorProps}
            >
              Servicios
              <ChevronDown className="ml-1 h-4 w-4" />
            </button>

            <ControlledMenu
              {...hoverProps}
              {...menuState}
              anchorRef={menuRef}
              onClose={() => toggleMenu(false)}
              menuClassName="!bg-white !border !border-gray-200 !rounded-xl !shadow-xl !p-2 !min-w-[280px]"
            >
              {/* Main Services */}
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Servicios Principales
              </div>
              {mainServices.map((service) => (
                <MenuItem key={service.href} className="!p-0 !rounded-lg hover:!bg-gray-50">
                  <Link
                    href={service.href}
                    className="flex items-start gap-3 p-3 w-full"
                  >
                    <div className={`p-2 rounded-lg bg-gray-100 ${service.color}`}>
                      <service.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{service.title}</div>
                      <p className="text-sm text-gray-500">{service.description}</p>
                    </div>
                  </Link>
                </MenuItem>
              ))}

              <hr className="my-2 border-gray-200" />

              {/* Insurance SubMenu */}
              <SubMenu
                label={
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Car className="w-4 h-4 text-amber-500" />
                    Seguros
                  </span>
                }
                className="!rounded-lg"
                menuClassName="!bg-white !border !border-gray-200 !rounded-xl !shadow-xl !p-2"
              >
                {insuranceServices.map((service) => (
                  <MenuItem key={service.href} className="!p-0 !rounded-lg hover:!bg-amber-50">
                    <Link
                      href={service.href}
                      className="flex items-center gap-2 p-2 w-full text-sm"
                    >
                      <service.icon className="w-4 h-4 text-amber-500" />
                      <span className="text-gray-700">{service.title}</span>
                    </Link>
                  </MenuItem>
                ))}
              </SubMenu>
            </ControlledMenu>

            {/* Other nav items */}
            {navigation.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNavClick(item.href)}
                className="nav-item text-gray-700 hover:text-gray-900 font-medium transition-colors relative px-4 py-2 flex items-center justify-center text-sm cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center gap-3">
            <Link href={isAuthenticated ? '/dashboard' : '/login'}>
              <Button
                variant="outline"
                className="rounded-full px-6 text-sm cursor-pointer"
              >
                {isAuthenticated ? 'Dashboard' : 'Login'}
              </Button>
            </Link>
            <Button
              className="bg-black text-white hover:bg-gray-800 rounded-full px-6 text-sm cursor-pointer"
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
                <MenuIcon className="h-6 w-6" />
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
                <CollapsibleTrigger className="flex items-center justify-between w-full text-gray-700 hover:text-[#F1AD32] font-medium transition-colors px-4 py-3 rounded hover:bg-[#F1AD32]/10 cursor-pointer">
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
                    <CollapsibleTrigger className="flex items-center justify-between w-full text-gray-600 hover:text-[#F1AD32] font-medium transition-colors px-4 py-2 rounded hover:bg-[#F1AD32]/10 cursor-pointer">
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
                  className="text-gray-700 hover:text-[#F1AD32] font-medium transition-colors px-4 py-3 rounded hover:bg-[#F1AD32]/10 text-left cursor-pointer"
                >
                  {item.label}
                </button>
              ))}

              <Link href={isAuthenticated ? '/dashboard' : '/login'} className="w-full">
                <Button
                  variant="outline"
                  className="rounded-full w-full mt-4 cursor-pointer"
                >
                  {isAuthenticated ? 'Dashboard' : 'Login'}
                </Button>
              </Link>
              <Button
                className="bg-black text-white hover:bg-gray-800 rounded-full w-full mt-2 cursor-pointer"
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
