import { Button } from "@/components/ui/button"
import { ArrowRight, TrendingUp, CheckCircle, Eye, Search, DollarSign, Linkedin, X } from "lucide-react"
import Image from "next/image"
import TestimonialSlider from "@/components/testimonial-slider"
import PricingSection from "@/components/pricing-section"
import ActionPlanSection from "@/components/action-plan-section" // Import the new ActionPlanSection
import FAQSection from "@/components/faq-section"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Reckless, serif" }}>
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <span className="text-xl font-bold text-gray-900">Administracion Segura</span>
            </div>
            <nav className="hidden md:flex space-x-8">
              <a href="#" className="text-gray-700 hover:text-gray-900 font-medium">
                Benefits
              </a>
              <a href="#" className="text-gray-700 hover:text-gray-900 font-medium">
                Testimonials
              </a>
              <a href="#" className="text-gray-700 hover:text-gray-900 font-medium">
                Quienes somos
              </a>
              <a href="#" className="text-gray-700 hover:text-gray-900 font-medium">
                How it works
              </a>
              <a href="#" className="text-gray-700 hover:text-gray-900 font-medium">
                Pricing
              </a>
            </nav>
            <Button className="bg-black text-white hover:bg-gray-800 rounded-full px-6">Get a free audit</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden bg-white">
        {/* Grid Background */}
        <div className="absolute inset-0 opacity-60">
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `
      linear-gradient(rgba(0,0,0,0.15) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,0,0,0.15) 1px, transparent 1px)
    `,
              backgroundSize: "30px 30px",
            }}
          />
          {/* Fade overlay - reduce opacity to show more grid */}
          <div className="absolute inset-0 bg-gradient-to-r from-white via-transparent to-white opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white opacity-30" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative z-10">
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Actionable insights to help your store convert more{" "}
                <span className="inline-flex items-center justify-center w-8 h-8 bg-green-500 rounded-full ml-2">
                  <CheckCircle className="w-5 h-5 text-white" />
                </span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-lg">
                Get a clear action plan to boost your website conversions through smarter UX, design, and messaging.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  className="bg-black text-white hover:bg-gray-800 rounded-full px-8 py-4 text-lg font-medium"
                >
                  Get your FREE Audit
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full px-8 py-4 text-lg font-medium border-2 border-gray-300 hover:bg-gray-50 bg-transparent"
                >
                  View Audit Pricing
                  <Eye className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Right side with circular composition */}
            <div className="relative z-10 flex justify-center">
              <div className="relative">
                {/* Large gray circle background */}
                <div className="w-96 h-96 bg-gray-400 rounded-full relative overflow-hidden">
                  {/* Hand holding phone image */}
                  <Image
                    src="/placeholder.svg?height=400&width=400"
                    alt="Hand holding phone with e-commerce site"
                    width={400}
                    height={400}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>

                {/* Floating UI elements */}
                {/* +18% Increase CRO card */}
                <div className="absolute -top-4 right-8 bg-blue-100 border border-blue-200 rounded-lg p-3 shadow-lg">
                  <div className="text-2xl font-bold text-blue-900">+18%</div>
                  <div className="text-sm text-blue-700">Increase CRO</div>
                  <div className="flex items-center mt-1">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-3 h-3 text-white" />
                    </div>
                    <div className="ml-2 flex space-x-1">
                      <div className="w-1 h-4 bg-gray-300 rounded"></div>
                      <div className="w-1 h-6 bg-gray-400 rounded"></div>
                      <div className="w-1 h-8 bg-gray-600 rounded"></div>
                      <div className="w-1 h-5 bg-gray-800 rounded"></div>
                    </div>
                  </div>
                </div>

                {/* +21% Shopping cart card */}
                <div className="absolute top-20 -left-8 bg-yellow-300 rounded-lg p-4 shadow-lg transform -rotate-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-6 h-6 bg-black rounded flex items-center justify-center">
                      <span className="text-white text-xs">🛒</span>
                    </div>
                    <div className="text-2xl font-bold text-black">+21%</div>
                  </div>
                  <div className="w-16 h-8 relative">
                    <svg viewBox="0 0 60 30" className="w-full h-full">
                      <polyline points="5,25 15,20 25,15 35,10 45,8 55,5" fill="none" stroke="black" strokeWidth="2" />
                      <circle cx="55" cy="5" r="2" fill="black" />
                    </svg>
                  </div>
                  <div className="absolute bottom-1 right-1 w-3 h-3 bg-black transform rotate-45"></div>
                </div>

                {/* Brandgrowth badge */}
                <div className="absolute bottom-8 right-4 bg-purple-600 text-white rounded-full px-4 py-2 shadow-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 text-white">✦</div>
                    <span className="font-medium">Brandgrowth</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By Section - Marquee */}
      <section className="py-8 bg-white border-b border-gray-200 overflow-hidden">
        <div className="relative">
          <div className="flex items-center mb-4 px-4 sm:px-6 lg:px-8">
            <span className="text-sm text-gray-600 whitespace-nowrap">Trusted by</span>
            <span className="text-sm text-gray-600 ml-1">top brands</span>
          </div>

          {/* Marquee Container */}
          <div className="relative overflow-hidden">
            {/* Fade overlays */}
            <div className="absolute left-0 top-0 w-20 h-full bg-gradient-to-r from-white to-transparent z-10"></div>
            <div className="absolute right-0 top-0 w-20 h-full bg-gradient-to-l from-white to-transparent z-10"></div>

            {/* Scrolling content */}
            <div className="animate-marquee">
              <div className="flex items-center space-x-16 px-8">
                <div className="text-2xl font-bold text-gray-400 whitespace-nowrap">GREYSLANDER</div>
                <div className="text-2xl font-bold text-gray-400 whitespace-nowrap">B/A</div>
                <div className="text-2xl font-bold text-gray-400 whitespace-nowrap">CHEEKY BONSAI</div>
                <div className="text-2xl font-bold text-gray-400 whitespace-nowrap">sundae</div>
                <div className="text-2xl font-bold text-gray-400 whitespace-nowrap">MORREALE</div>
                <div className="text-2xl font-bold text-gray-400 whitespace-nowrap">Just Eno</div>
                <div className="text-2xl font-bold text-gray-400 whitespace-nowrap">GREYSLANDER</div>
                <div className="text-2xl font-bold text-gray-400 whitespace-nowrap">B/A</div>
                <div className="text-2xl font-bold text-gray-400 whitespace-nowrap">CHEEKY BONSAI</div>
                <div className="text-2xl font-bold text-gray-400 whitespace-nowrap">sundae</div>
                <div className="text-2xl font-bold text-gray-400 whitespace-nowrap">MORREALE</div>
                <div className="text-2xl font-bold text-gray-400 whitespace-nowrap">Just Eno</div>
                <div className="text-2xl font-bold text-gray-400 whitespace-nowrap">GREYSLANDER</div>
                <div className="text-2xl font-bold text-gray-400 whitespace-nowrap">B/A</div>
                <div className="text-2xl font-bold text-gray-400 whitespace-nowrap">CHEEKY BONSAI</div>
                <div className="text-2xl font-bold text-gray-400 whitespace-nowrap">sundae</div>
                <div className="text-2xl font-bold text-gray-400 whitespace-nowrap">MORREALE</div>
                <div className="text-2xl font-bold text-gray-400 whitespace-nowrap">Just Eno</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* New Section: Get Valuable Insights */}
      <section className="grid grid-cols-1 lg:grid-cols-2 min-h-[400px] border-b border-gray-200">
        {/* Left Column */}
        <div className="bg-green-50 flex flex-col items-center justify-center p-8 lg:p-16 text-center lg:text-left">
          <div className="max-w-md mx-auto">
            <div className="mb-6">
              <Search className="w-16 h-16 text-gray-900 mx-auto lg:mx-0" />
            </div>
            <h2 className="text-4xl font-bold text-gray-900 leading-tight">
              Get valuable insights to increase your conversions, average order value and build brand trust.
            </h2>
          </div>
        </div>

        {/* Right Column */}
        <div className="bg-white flex flex-col items-center justify-center p-8 lg:p-16 text-center lg:text-left">
          <div className="max-w-md mx-auto">
            <p className="text-xl text-gray-600 mb-8">
              Turn your website visitors into happy customers. We analyze your store, identify friction points, and
              craft a plan to improve conversions tailor made for your brand.
            </p>
            <Button
              size="lg"
              className="bg-black text-white hover:bg-gray-800 rounded-full px-8 py-4 text-lg font-medium"
            >
              Get your FREE Audit
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Transform E-commerce Site Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-4">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>BENEFITS
            </span>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
              Transform your e-commerce site with a CRO audit.
            </h2>
          </div>

          <div className="space-y-16">
            {/* Card 1: Uncover hidden conversion killers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="lg:order-1">
                <h3 className="text-3xl font-bold text-gray-900 mb-4">Uncover hidden conversion killers</h3>
                <p className="text-lg text-gray-600">
                  A deep into your website to uncover user Friction Points. We'll help you gain insights and help
                  prioritise areas of improvement to streamline the conversion process.
                </p>
              </div>
              <div className="relative w-full h-80 lg:h-96 rounded-lg overflow-hidden shadow-lg lg:order-2">
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
                  src="/placeholder.svg?height=400&width=400"
                  alt="Person using tablet with e-commerce analytics"
                  width={400}
                  height={400}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute bottom-8 right-8 bg-yellow-200 rounded-lg p-3 shadow-md">
                  <div className="flex items-center">
                    <ArrowRight className="w-5 h-5 rotate-[-90deg] mr-2" />
                    <span className="text-2xl font-bold text-yellow-900">+18%</span>
                  </div>
                  <div className="text-sm text-yellow-800">Average CRO Uplift</div>
                </div>
              </div>
            </div>

            {/* Card 2: Increase AOV and boosting brand trust */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="relative w-full h-80 lg:h-96 rounded-lg overflow-hidden shadow-lg lg:order-1">
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
                  src="/placeholder.svg?height=400&width=400"
                  alt="Person packing a box for shipping"
                  width={400}
                  height={400}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute top-8 right-8 bg-purple-200 rounded-lg p-3 shadow-md">
                  <div className="flex items-center">
                    <span className="text-xl font-bold text-purple-900 mr-2">AOV</span>
                    <TrendingUp className="w-5 h-5 text-purple-900" />
                  </div>
                  <div className="text-2xl font-bold text-purple-900">+21%</div>
                </div>
                <Image
                  src="/placeholder.svg?height=60&width=60"
                  alt="Happy customer avatar"
                  width={60}
                  height={60}
                  className="absolute bottom-8 right-8 rounded-full border-2 border-white shadow-md"
                />
              </div>
              <div className="lg:order-2">
                <h3 className="text-3xl font-bold text-gray-900 mb-4">Increase AOV and boosting brand trust</h3>
                <p className="text-lg text-gray-600">
                  Optimize product recommendations to help boost average order value (AOV). Enhance user experience,
                  streamline checkout, and build trust to foster customer loyalty and repeat business.
                </p>
              </div>
            </div>

            {/* Card 3: Reduce acquisition costs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="lg:order-1">
                <h3 className="text-3xl font-bold text-gray-900 mb-4">Reduce acquisition costs</h3>
                <p className="text-lg text-gray-600">
                  Maximize the value of existing traffic and ad spend. We'll help streamline the customer journey,
                  leading to higher conversion rates and lower acquisition costs per customer.
                </p>
              </div>
              <div className="relative w-full h-80 lg:h-96 rounded-lg overflow-hidden shadow-lg lg:order-2">
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
                  src="/placeholder.svg?height=400&width=400"
                  alt="Person looking at phone with spring collection preview"
                  width={400}
                  height={400}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute top-8 left-8 bg-green-200 rounded-lg p-3 shadow-md">
                  <div className="flex items-center mb-1">
                    <DollarSign className="w-5 h-5 text-green-900 mr-1" />
                    <span className="text-sm font-bold text-green-900">Today 9:45am</span>
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
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial Slider Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-4">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>TRUSTED BY TOP BRANDS
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-12 max-w-3xl mx-auto">
            Helping brands like yours exceed conversion goals
          </h2>

          <TestimonialSlider />
        </div>
      </section>

      {/* 3 Steps to Better Conversions Section */}
      <section className="py-20 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-4">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>HOW IT WORKS
            </span>
            <h2 className="text-4xl lg:text-5xl font-normal text-gray-900 leading-tight">
              3 steps to better conversions
            </h2>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {/* Línea horizontal de conexión para desktop */}
            <div className="hidden md:block absolute top-[32px] left-0 right-0 h-px bg-gray-300 z-0" />

            {/* Step 1 */}
            <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left">
              <div
                className="relative w-16 h-16 flex items-center justify-center rounded-lg text-white text-2xl font-bold mb-6"
                style={{ backgroundColor: "#FFD700" }}
              >
                1
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Kickstart your optimization</h3>
              <p className="text-lg text-gray-600">
                Order your CRO audit and complete a brief onboarding form. This helps us understand your brand, goals,
                and target audience, ensuring a tailored approach to your audit.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left">
              <div
                className="relative w-16 h-16 flex items-center justify-center rounded-lg text-blue-800 text-2xl font-bold mb-6"
                style={{ backgroundColor: "#E0F2F7" }}
              >
                2
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Uncover hidden opportunities</h3>
              <p className="text-lg text-gray-600">
                Our team will create your audit by analysing your website's user journey to pinpoint pain points and
                reveal strategies for boosting conversions.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left">
              <div
                className="relative w-16 h-16 flex items-center justify-center rounded-lg text-purple-800 text-2xl font-bold mb-6"
                style={{ backgroundColor: "#E6E0FF" }}
              >
                3
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Receive your actionable CRO audit</h3>
              <p className="text-lg text-gray-600">
                In two weeks, you'll receive a personalized audit filled with insights and recommendations to optimize
                your website.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* Action Plan Section */}
      <ActionPlanSection />

      {/* FAQ Section */}
      <FAQSection />

    </div>
      )
    }


      
