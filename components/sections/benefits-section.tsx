import { features } from '@/data/features'
import { Search, ArrowRight, TrendingUp, DollarSign } from 'lucide-react'
import Image from 'next/image'

const iconMap = {
  search: Search,
  'trending-up': TrendingUp,
  'dollar-sign': DollarSign,
}

export default function BenefitsSection() {
  return (
    <>
      {/* Intro Section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 min-h-[400px] border-b border-gray-200">
        {/* Left Column */}
        <div className="bg-green-50 flex flex-col items-center justify-center p-8 lg:p-16 text-center lg:text-left" style={{ fontFamily: "Reckless, serif" }}>
          <div className="max-w-md mx-auto">
            <div className="mb-6">
              <Search className="w-16 h-16 text-gray-900 mx-auto lg:mx-0" />
            </div>
            <h2 className="text-4xl font-bold text-gray-900 leading-tight">
              Obtén tranquilidad y cumplimiento total en Seguridad Social para tu empresa y trabajadores independientes.
            </h2>
          </div>
        </div>

        {/* Right Column */}
        <div className="bg-white flex flex-col items-center justify-center p-8 lg:p-16 text-center lg:text-left" style={{ fontFamily: "Reckless, serif" }}>
          <div className="max-w-md mx-auto">
            <p className="text-xl text-gray-600 mb-8">
              Maneja todos los aspectos de la Seguridad Social sin complicaciones. Nos encargamos de afiliaciones, liquidaciones PILA 
              y recobros, para que te enfoques en hacer crecer tu negocio con total tranquilidad.
            </p>
            <button className="bg-black text-white hover:bg-gray-800 rounded-full px-8 py-4 text-lg font-medium inline-flex items-center transition-colors">
              Consultoría GRATIS
              <ArrowRight className="ml-2 w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gray-50" id="benefits" style={{ fontFamily: "Reckless, serif" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-4">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>BENEFICIOS
            </span>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
              Simplifica tu Seguridad Social con Nuestros Servicios Especializados
            </h2>
          </div>

          <div className="space-y-16">
            {features.map((feature, index) => {
              const IconComponent = iconMap[feature.icon as keyof typeof iconMap]
              const isEven = index % 2 === 0

              return (
                <div 
                  key={feature.id}
                  className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${
                    isEven ? '' : 'lg:grid-flow-col-dense'
                  }`}
                >
                  <div className={isEven ? 'lg:order-1' : 'lg:order-2'}>
                    <h3 className="text-3xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                    <p className="text-lg text-gray-600">{feature.description}</p>
                  </div>
                  
                  <div className={`relative w-full h-80 lg:h-96 rounded-lg overflow-hidden shadow-lg ${
                    isEven ? 'lg:order-2' : 'lg:order-1'
                  }`}>
                    {/* Grid background */}
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `
                          linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
                        `,
                        backgroundSize: "20px 20px",
                      }}
                    />
                    <Image
                      src={feature.image || '/placeholder.svg?height=400&width=400'}
                      alt={feature.title}
                      width={400}
                      height={400}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    
                    {/* Stats overlay */}
                    {feature.stats && (
                      <div className={`absolute ${
                        index === 0 ? 'bottom-8 right-8 bg-yellow-200' :
                        index === 1 ? 'top-8 right-8 bg-purple-200' :
                        'top-8 left-8 bg-green-200'
                      } rounded-lg p-3 shadow-md`}>
                        {index === 0 && (
                          <div className="flex items-center">
                            <ArrowRight className="w-5 h-5 rotate-[-90deg] mr-2" />
                            <span className="text-2xl font-bold text-gray-900">{feature.stats.value}</span>
                          </div>
                        )}
                        {index === 1 && (
                          <>
                            <div className="flex items-center">
                              <span className="text-xl font-bold text-purple-900 mr-2">AOV</span>
                              <TrendingUp className="w-5 h-5 text-purple-900" />
                            </div>
                            <div className="text-2xl font-bold text-purple-900">{feature.stats.value}</div>
                          </>
                        )}
                        {index === 2 && (
                          <>
                            <div className="flex items-center mb-1">
                              <DollarSign className="w-5 h-5 text-green-900 mr-1" />
                              <span className="text-sm font-bold text-green-900">Hoy 9:45am</span>
                            </div>
                            <div className="w-24 h-12 relative">
                              <svg viewBox="0 0 100 50" className="w-full h-full">
                                <polyline
                                  points="5,45 25,20 45,35 65,10 85,40 95,25"
                                  fill="none"
                                  stroke="black"
                                  strokeWidth="2"
                                />
                                <circle cx="65" cy="10" r="3" fill="black" />
                              </svg>
                            </div>
                          </>
                        )}
                        <div className="text-sm text-gray-800">{feature.stats.label}</div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}