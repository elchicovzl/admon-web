import ServiceCard from "./service-card"
import { serviceCategoriesData } from "@/data/services"

export default function ServicesSection() {
  return (
    <section className="py-20 bg-[#F0FFE0]">
      {" "}
      {/* Light green background */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16">
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-normal text-gray-900 leading-tight mb-4 md:mb-0">
            Nuestros Servicios Especializados
          </h2>
          <p className="text-lg text-gray-600 max-w-md">
            Soluciones integrales en seguridad social y gestión empresarial. Más de 10 años de experiencia al servicio de empresas e independientes.
          </p>
        </div>

        {/* Services Cards Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {serviceCategoriesData.map((category) => (
            <ServiceCard key={category.id} {...category} />
          ))}
        </div>

        <div className="text-center mt-16 text-gray-600 text-lg">
          ¿Necesitas una cotización personalizada o quieres conocer más detalles?{" "}
          <a href="#" className="text-gray-900 underline">
            Contáctanos
          </a>
        </div>
      </div>
    </section>
  )
}