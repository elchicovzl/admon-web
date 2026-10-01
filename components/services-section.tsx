'use client'

import ServiceCard from "./service-card"
import { serviceCategoriesData } from "@/data/services"
import { useSmoothScroll } from "@/hooks/use-smooth-scroll"
import { Button } from "@/components/ui/button"

export default function ServicesSection() {
  const { scrollToSection } = useSmoothScroll()
  return (
    <section className="py-20 bg-surface-muted" id="features">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-figtree font-bold text-brand-navy leading-tight mb-4 md:mb-0">
            Nuestros Servicios Especializados
          </h2>
          <p className="text-lg text-gray-600 max-w-md">
            Soluciones integrales en seguridad social y gestión empresarial. Más de 10 años de experiencia al servicio de empresas e independientes.
          </p>
        </div>

        {/* Services Cards Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {serviceCategoriesData.map((category) => (
            <ServiceCard key={category.id} {...category} />
          ))}
        </div>

        <div className="text-center mt-16 text-gray-600 text-lg">
          ¿Necesitas una cotización personalizada o quieres conocer más detalles?{" "}
          <Button
            variant="link"
            onClick={() => scrollToSection('contacto')}
            className="p-0 h-auto text-lg text-brand-navy font-semibold underline hover:text-brand-navy/80 cursor-pointer"
          >
            Contáctanos
          </Button>
        </div>
      </div>
    </section>
  )
}