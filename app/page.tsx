import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import HeroSection from '@/components/sections/hero-section'
import TrustedBrandsSection from '@/components/sections/trusted-brands-section'
import BenefitsSection from '@/components/sections/benefits-section'
import TestimonialsSection from '@/components/sections/testimonials-section'
import ProcessSection from '@/components/sections/process-section'
import PricingSection from '@/components/pricing-section'
import ActionPlanSection from '@/components/action-plan-section'
import FAQSection from '@/components/faq-section'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Reckless, serif" }}>
      <Header />
      
      <main>
        <HeroSection />
        <TrustedBrandsSection />
        <BenefitsSection />
        <TestimonialsSection />
        <ProcessSection />
        <PricingSection />
        <ActionPlanSection />
        <FAQSection />
      </main>

      <Footer />
    </div>
  )
}