import { processSteps } from '@/data/features'
import CardSwap, { Card } from '@/components/ui/card-swap'
import ScrollStack, { ScrollStackItem } from '@/components/ui/scroll-stack'
import { memo } from 'react'
import { SectionLabel } from '@/components/ui/section-label'

// Memoized header component to avoid duplication
const ProcessHeader = memo(({ isMobile }: { isMobile?: boolean }) => (
  <div className={isMobile ? 'text-center mb-12' : 'text-left'}>
    <SectionLabel className="mb-4">Cómo funciona</SectionLabel>
    <h2 className="text-3xl md:text-4xl lg:text-5xl font-figtree font-bold text-brand-navy leading-tight">
      3 pasos para tu tranquilidad
    </h2>
  </div>
))

ProcessHeader.displayName = 'ProcessHeader'

// Memoized card content component to avoid duplication
const ProcessStepCard = memo(({ step, isMobile }: { step: typeof processSteps[0]; isMobile?: boolean }) => (
  <div className={`${isMobile ? 'p-3' : 'p-8'} h-full flex flex-col justify-center bg-white border border-gray-200 rounded-2xl`}>
    <div
      className={`w-16 ${isMobile ? 'h-18' : 'h-16'} flex items-center justify-center rounded-xl text-2xl font-bold mb-6 mx-auto shadow-sm bg-brand-gold text-brand-navy`}
    >
      {step.step}
    </div>
    <h3 className={`text-2xl font-figtree font-bold text-brand-navy mb-4 text-center ${isMobile ? 'leading-tight' : ''}`}>
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
    <section className="relative py-20 bg-white" id="process">
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