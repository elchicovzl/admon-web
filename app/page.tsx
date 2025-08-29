import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import HeroSection from '@/components/sections/hero-section'
import TrustedBrandsSection from '@/components/sections/trusted-brands-section'
import BenefitsSection from '@/components/sections/benefits-section'
import TestimonialsSection from '@/components/sections/testimonials-section'
import ProcessSection from '@/components/sections/process-section'
import ServicesSection from '@/components/services-section'
import ActionPlanSection from '@/components/action-plan-section'
import FAQSection from '@/components/faq-section'
import ContactSection from '@/components/sections/contact-section'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      <main>
        <HeroSection />
        <TrustedBrandsSection />
        <BenefitsSection />
        <TestimonialsSection />
        <ProcessSection />
        <ServicesSection />
        <ActionPlanSection />
        <FAQSection />
        <ContactSection />
      </main>

      <Footer />
    </div>
  )
}