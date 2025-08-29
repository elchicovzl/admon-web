import { processSteps } from '@/data/features'

export default function ProcessSection() {
  return (
    <section className="py-20 bg-white border-t border-gray-200" id="process">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-4">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>CÓMO FUNCIONA
          </span>
          <h2 className="text-4xl lg:text-5xl font-normal text-gray-900 leading-tight">
            3 pasos para tu tranquilidad
          </h2>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {/* Línea horizontal de conexión para desktop */}
          <div className="hidden md:block absolute top-[32px] left-0 right-0 h-px bg-gray-300 z-0" />

          {processSteps.map((step) => (
            <div key={step.id} className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left">
              <div
                className="relative w-16 h-16 flex items-center justify-center rounded-lg text-white text-2xl font-bold mb-6"
                style={{ backgroundColor: step.backgroundColor }}
              >
                <span style={{ color: step.color === step.backgroundColor ? '#fff' : step.color }}>
                  {step.step}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-lg text-gray-600">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}