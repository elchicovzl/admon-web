"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface FAQItem {
  question: string
  answer: string
}

const faqs: FAQItem[] = [
  {
    question: "What is a CRO audit?",
    answer:
      "A Conversion Rate Optimization (CRO) audit is a comprehensive analysis of your website designed to identify areas where users might be encountering friction or dropping off, and to provide actionable recommendations to improve your website's conversion rates (e.g., sales, sign-ups, leads).",
  },
  {
    question: "Why are CRO audits important?",
    answer:
      "CRO audits are crucial because they help you maximize the value of your existing website traffic. Instead of spending more on ads to get new visitors, a CRO audit helps you convert more of the visitors you already have, leading to increased revenue and a better return on investment.",
  },
  {
    question: "How long will it take to receive my audit?",
    answer:
      "The delivery time varies depending on the audit package you choose. Our Free Bite-sized Audit is delivered in 2 days, the Basic CRO Audit in 3-4 days, and the Essential CRO Audit in 2 weeks.",
  },
  {
    question: "What is included in the audit?",
    answer:
      "Each audit package includes different deliverables. For example, the Essential CRO Audit includes an in-depth website review, 10x section redesigns, a 40+ actionable fixes checklist, a 25+ page PDF report, and access to developer-friendly design files.",
  },
  {
    question: "Can you implement the recommendations mentioned in my CRO audit?",
    answer:
      "Our primary service is providing the audit and recommendations. While we don't offer full implementation services, our recommendations are designed to be clear and actionable, often including developer-friendly design files to make implementation easier for your team or a developer.",
  },
  {
    question: "What types of businesses do you work with?",
    answer:
      "We specialize in e-commerce businesses of various sizes, from startups to established brands, looking to optimize their online stores for better conversions and growth.",
  },
  {
    question: "Can you build my online store from scratch?",
    answer:
      "No, our focus is on Conversion Rate Optimization (CRO) for existing e-commerce websites. We help you improve your current store's performance rather than building new ones from scratch.",
  },
  {
    question: "What is your refund policy?",
    answer:
      "We offer a 30-day money-back guarantee on our paid CRO audit packages. If you're not satisfied with the insights and recommendations provided, you can request a full refund within 30 days of receiving your audit.",
  },
]

export default function FAQSection() {
  return (
    <section className="py-20" style={{ backgroundColor: "#F8F5F0" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
        <div className="md:sticky md:top-20 max-w-xs">
          {" "}
          {/* Added max-w-xs here */}
          <h2 className="text-5xl font-normal text-gray-900 leading-tight text-left">
            {" "}
            {/* Added text-left */}
            Have more questions?
          </h2>
        </div>
        <div>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-b border-gray-300 py-3">
                {" "}
                {/* Changed py-4 to py-3 */}
                <AccordionTrigger className="flex justify-between items-center text-lg font-medium text-gray-900 hover:no-underline [&>svg]:hidden">
                  {" "}
                  {/* Added [&>svg]:hidden */}
                  {faq.question}
                  <div className="w-5 h-5 border border-gray-400 rounded-full flex-shrink-0 ml-4" />
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 text-base pt-2 pb-4">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
