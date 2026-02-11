import { processSteps } from '@/data/features'
import CardSwap, { Card } from '@/components/ui/card-swap'
import ScrollStack, { ScrollStackItem } from '@/components/ui/scroll-stack'
import { memo } from 'react'

// Memoized header component to avoid duplication
const ProcessHeader = memo(({ isMobile }: { isMobile?: boolean }) => (
  <div className={isMobile ? 'text-center mb-12' : 'text-left'}>
    <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 mb-4 shadow-sm border border-blue-200/50">
      <span className="w-2 h-2 bg-gradient-to-r from-blue-500 to-blue-400 rounded-full mr-2"></span>CÓMO FUNCIONA
    </span>
    <h2 className="text-3xl md:text-4xl lg:text-5xl font-normal text-gray-900 leading-tight">
      3 pasos para tu tranquilidad
    </h2>
  </div>
))

ProcessHeader.displayName = 'ProcessHeader'

// Memoized card content component to avoid duplication
const ProcessStepCard = memo(({ step, isMobile }: { step: typeof processSteps[0]; isMobile?: boolean }) => (
  <div className={`${isMobile ? 'p-3' : 'p-8'} h-full flex flex-col justify-center bg-gradient-to-br from-gray-50/50 to-white/80 rounded-xl`}>
    <div
      className={`w-16 ${isMobile ? 'h-18' : 'h-16'} flex items-center justify-center rounded-xl text-2xl font-bold mb-6 mx-auto shadow-sm`}
      style={{
        background: `linear-gradient(135deg, ${step.backgroundColor}, ${step.backgroundColor}dd)`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}
    >
      <span style={{ color: step.color === step.backgroundColor ? '#fff' : step.color }}>
        {step.step}
      </span>
    </div>
    <h3 className={`text-2xl font-bold text-gray-900 mb-4 text-center ${isMobile ? 'leading-tight' : ''}`}>
      {step.title}
    </h3>
    <p className={`text-gray-600 leading-relaxed text-center ${isMobile ? 'text-sm' : ''}`}>
      {step.description}
    </p>
  </div>
))

ProcessStepCard.displayName = 'ProcessStepCard'

export default function ProcessSection() {
  return (
    <section className="relative py-20 bg-gradient-to-b from-white via-blue-50/40 to-white border-t border-blue-100/50" id="process">
      {/* Decorative Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#F1AD32]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <ProcessHeader />

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
                  <ProcessStepCard step={step} />
                </Card>
              ))}
            </CardSwap>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden">
          {/* Mobile Header */}
          <ProcessHeader isMobile />

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
                      <ProcessStepCard step={step} isMobile />
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