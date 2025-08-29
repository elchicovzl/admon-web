import type React from "react"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface FeatureItem {
  text: string
  isBold?: boolean
}

interface ActionPlanCardProps {
  iconBgColor: string
  icon: React.ReactNode
  title: string
  description: string
  features: FeatureItem[]
}

function ActionPlanCard({ iconBgColor, icon, title, description, features }: ActionPlanCardProps) {
  return (
    <div className="flex flex-col border border-gray-200 rounded-xl shadow-sm bg-white">
      <div className="flex items-center p-6">
        <div className={cn("w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0", iconBgColor)}>
          {icon}
        </div>
        <div className="ml-6">
          <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
        </div>
      </div>
      <div className="p-6 pt-0">
        <p className="text-lg text-gray-600 mb-6">{description}</p>
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center text-gray-700 text-base">
              <svg
                className="w-5 h-5 text-gray-500 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                <path d="M9 12l2 2 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className={cn({ "font-bold": feature.isBold })}>{feature.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function ActionPlanSection() {
  const inDepthAnalysisIcon = (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-gray-900"
    >
      <path
        d="M14.6667 24.6667C20.2295 24.6667 24.6667 20.2295 24.6667 14.6667C24.6667 9.10385 20.2295 4.66669 14.6667 4.66669C9.10385 4.66669 4.66669 9.10385 4.66669 14.6667C4.66669 20.2295 9.10385 24.6667 14.6667 24.6667Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M27.3333 27.3334L22.6667 22.6667"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  const conversionRedesignsIcon = (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-gray-900"
    >
      <path
        d="M16 4C9.37258 4 4 9.37258 4 16C4 22.6274 9.37258 28 16 28C22.6274 28 28 22.6274 28 16C28 9.37258 22.6274 4 16 4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16 4V28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M22 10C20.3431 10 19 11.3431 19 13C19 14.6569 20.3431 16 22 16C23.6569 16 25 14.6569 25 13C25 11.3431 23.6569 10 22 10Z"
        fill="currentColor"
      />
    </svg>
  )

  const actionableChecklistIcon = (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-gray-900"
    >
      <path
        d="M26.6667 8L13.3333 21.3333L8 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 4C9.37258 4 4 9.37258 4 16C4 22.6274 9.37258 28 16 28C22.6274 28 28 22.6274 28 16C28 9.37258 22.6274 4 16 4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  return (
    <section className="py-20 bg-white" id="nosotros">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center mb-16">
          <div className="lg:pr-12">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-4">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>Quienes somos
            </span>
            <h2
              className="text-3xl md:text-5xl lg:text-6xl font-normal text-gray-900 leading-tight"
            >
              Nosotros
            </h2>
          </div>
          <div className="flex items-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <ArrowRight className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-lg md:text-xl text-gray-600 ml-6">
              Administración segura es una empresa que ofrece servicios de trámites y
              afiliaciones a trabajadores independientes y empresas a la SEGURIDAD SOCIAL
              INTEGRAL
            </p>
          </div>
        </div>

        {/* Cards Section */}
        <div className="grid grid-cols-1 gap-8">
          <ActionPlanCard
            iconBgColor="bg-blue-50"
            icon={inDepthAnalysisIcon}
            title="Nuestra Misión"
            description="Administración segura es una empresa que ofrece servicios de trámites y
              afiliaciones a trabajadores independientes y empresas a la SEGURIDAD SOCIAL
              INTEGRAL."
            features={[
              { text: "Salud" },
              { text: "Pensión" },
              { text: "Riesgos laborales" },
              { text: "Caja de compensación familiar" },
            ]}
          />
          <ActionPlanCard
            iconBgColor="bg-orange-50"
            icon={conversionRedesignsIcon}
            title="Visión"
            description="Ser una empresa reconocida a nivel regional y lograr la confianza y credibilidad de
empresas e independientes en el sector de la seguridad social mediante procesos
agiles, manejo transparente de los recursos dentro del marco legal."
            features={[
              { text: "Liderazgo Regional" },
              { text: "Procesos Ágiles" },
              { text: "Transparencia Legal" },
            ]}
          />
          <ActionPlanCard
            iconBgColor="bg-yellow-50"
            icon={actionableChecklistIcon}
            title="Valores"
            description="En ADMINISTRACIÓN SEGURA, entendemos que la confianza es la base de cada relación. Por eso, nuestros procesos y la manera en que nos conectamos con nuestros clientes están guiados por una serie de valores fundamentales que definen quiénes somos y cómo trabajamos."
            features={[
              { text: "Confianza" },
              { text: "Eficiencia" },
              { text: "Responsabilidad" },
              { text: "Integridad" },
            ]}
          />
        </div>
      </div>
    </section>
  )
}
