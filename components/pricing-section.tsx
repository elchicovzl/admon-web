import PricingCard from "./pricing-card"

export default function PricingSection() {
  const freeAuditIcon = (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-gray-900"
    >
      <rect x="12" y="12" width="8" height="8" fill="currentColor" />
      <rect x="28" y="12" width="8" height="8" fill="currentColor" />
      <rect x="12" y="28" width="8" height="8" fill="currentColor" />
      <rect x="28" y="28" width="8" height="8" fill="currentColor" />
    </svg>
  )

  const basicAuditIcon = (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-gray-900"
    >
      <rect x="12" y="12" width="8" height="8" fill="currentColor" />
      <rect x="20" y="12" width="8" height="8" fill="currentColor" />
      <rect x="28" y="12" width="8" height="8" fill="currentColor" />
      <rect x="12" y="20" width="8" height="8" fill="currentColor" />
      <rect x="20" y="20" width="8" height="8" fill="currentColor" />
      <rect x="28" y="20" width="8" height="8" fill="currentColor" />
      <rect x="12" y="28" width="8" height="8" fill="currentColor" />
      <rect x="20" y="28" width="8" height="8" fill="currentColor" />
      <rect x="28" y="28" width="8" height="8" fill="currentColor" />
    </svg>
  )

  const essentialAuditIcon = (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-gray-900"
    >
      <path
        d="M24 4L12 24L24 44L36 24L24 4Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M24 4L36 24L24 44L12 24L24 4Z" fill="currentColor" />
    </svg>
  )

  const pricingPlans = [
    {
      title: "Free Bite-sized Audit",
      description:
        "Get a quick win. We'll redesign 1 section of your site and provide three insights to improve conversions.",
      price: "$0",
      deliveryTime: "Delivered in 2 days",
      features: [
        "1x conversion-focused redesign of a section on your website",
        "3x quick improvements to enhance your site's UX",
        "Completely Free - No obligations",
      ],
      noCreditCard: true,
      bgColor: "bg-white",
      textColor: "text-gray-900",
      icon: freeAuditIcon,
      buttonText: "Get Your FREE Audit",
    },
    {
      title: "Basic CRO Audit",
      description: "Choose 2x pages on your website and we'll provide insights to help improve conversions.",
      price: "$295",
      deliveryTime: "Delivered in 3-4 days",
      features: [
        "NEW",
        "2x page audit (dashed)",
        "4x Section redesigns, optimized to boost conversions (dashed)",
        "15+ actionable checklist (dashed)",
        "PDF report (dashed)",
        "Access to developer-friendly design files (dashed)",
        "30-day money back guarantee (dashed)",
      ],
      bgColor: "bg-[#FFFFE0]", // Light yellow
      textColor: "text-gray-900",
      icon: basicAuditIcon,
      buttonText: "Order Basic CRO",
    },
    {
      title: "Essential CRO Audit",
      description: "Receive a comprehensive audit with actionable insights to transform your website's performance.",
      price: "$975",
      oldPrice: "$1,450",
      deliveryTime: "Limited time pricing - Delivered in 2 weeks",
      features: [
        "In-depth website review (dashed)",
        "10x Section redesigns, optimized to boost conversions (dashed)",
        "40+ Actionable fixes checklist (dashed)",
        "25+ Page PDF report (dashed)",
        "Access to developer-friendly design files (dashed)",
        "30-day money back guarantee (dashed)",
      ],
      isBestValue: true,
      bgColor: "bg-[#E6E0FF]", // Light purple
      textColor: "text-gray-900",
      icon: essentialAuditIcon,
      buttonText: "Order Essential CRO",
    },
  ]

  return (
    <section className="py-20 bg-[#F0FFE0]">
      {" "}
      {/* Light green background */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16">
          <h2 className="text-4xl lg:text-5xl font-normal text-gray-900 leading-tight mb-4 md:mb-0">
            CRO audits to unlock growth
          </h2>
          <p className="text-lg text-gray-600 max-w-md">
            30-Day money-back guarantee. Exposes common pain points and unlock hidden conversion killers.
          </p>
        </div>

        {/* Pricing Cards Container - can be a slider */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {pricingPlans.map((plan, index) => (
            <PricingCard key={index} {...plan} />
          ))}
        </div>

        <div className="text-center mt-16 text-gray-600 text-lg">
          Need a custom quote? Or like to discuss before making up your mind, please{" "}
          <a href="#" className="text-gray-900 underline">
            contact us
          </a>
        </div>
      </div>
    </section>
  )
}
