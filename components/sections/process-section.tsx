import { processSteps } from '@/data/features'
import CardSwap, { Card } from '@/components/ui/card-swap'
import ScrollStack, { ScrollStackItem } from '@/components/ui/scroll-stack'

export default function ProcessSection() {
  return (
    <section className="py-20 bg-white border-t border-gray-200" id="process">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="text-left">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-4">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>CÓMO FUNCIONA
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-normal text-gray-900 leading-tight">
              3 pasos para tu tranquilidad
            </h2>
          </div>

          {/* Right Content - CardSwap */}
          <div className="relative h-[600px] flex justify-center items-center">
            <CardSwap
              width={500}
              height={350}
              cardDistance={30}
              verticalDistance={105}
              delay={5000}
              pauseOnHover={true}
              easing="linear"
              skewAmount={6}
            >
              {processSteps.map((step) => (
                <Card key={step.id}>
                  <div className="p-8 h-full flex flex-col justify-center bg-gradient-to-br from-gray-50/50 to-white/80 rounded-xl">
                    <div
                      className="w-16 h-16 flex items-center justify-center rounded-xl text-2xl font-bold mb-6 mx-auto shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, ${step.backgroundColor}, ${step.backgroundColor}dd)`,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    >
                      <span style={{ color: step.color === step.backgroundColor ? '#fff' : step.color }}>
                        {step.step}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">{step.title}</h3>
                    <p className="text-gray-600 leading-relaxed text-center">{step.description}</p>
                  </div>
                </Card>
              ))}
            </CardSwap>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden">
          {/* Mobile Header */}
          <div className="text-center mb-12">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-4">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>CÓMO FUNCIONA
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-normal text-gray-900 leading-tight">
              3 pasos para tu tranquilidad
            </h2>
          </div>

          {/* Mobile ScrollStack */}
          <div className="relative min-h-[150vh] flex justify-center items-start pt-8">
            {/* Border Container Frame */}
            <div className="relative w-full max-w-sm mx-auto">
              {/* Border Frame */}
              <div className="absolute inset-0 border-2 border-gray-300 rounded-2xl bg-white/10 z-10 pointer-events-none"></div>

              {/* ScrollStack Content */}
              <div className="relative z-0">
                <ScrollStack
                  useWindowScroll={true}
                  itemDistance={50}
                  itemScale={0.02}
                  itemStackDistance={30}
                  stackPosition="10%"
                  scaleEndPosition="10%"
                  baseScale={0.9}
                  blurAmount={0}
                >
                  {processSteps.map((step) => (
                    <ScrollStackItem key={step.id}>
                      <div className="h-full flex flex-col justify-center bg-gradient-to-br from-gray-50/50 to-white/80 rounded-xl p-3">
                        <div
                          className="w-16 h-18 flex items-center justify-center rounded-xl text-2xl font-bold mb-6 mx-auto shadow-sm"
                          style={{
                            background: `linear-gradient(135deg, ${step.backgroundColor}, ${step.backgroundColor}dd)`,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          }}
                        >
                          <span style={{ color: step.color === step.backgroundColor ? '#fff' : step.color }}>
                            {step.step}
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center leading-tight">{step.title}</h3>
                        <p className="text-gray-600 leading-relaxed text-center text-sm">{step.description}</p>
                      </div>
                    </ScrollStackItem>
                  ))}
                </ScrollStack>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}