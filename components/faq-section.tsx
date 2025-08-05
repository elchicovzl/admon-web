"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { faqs } from '@/data/faqs'

export default function FAQSection() {
  return (
    <section className="py-20" style={{ backgroundColor: "#F8F5F0", fontFamily: "Reckless, serif" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
        <div className="md:sticky md:top-20 max-w-xs">
          <h2 className="text-5xl font-normal text-gray-900 leading-tight text-left">
            ¿Tienes más preguntas?
          </h2>
        </div>
        <div>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq) => (
              <AccordionItem key={faq.id} value={faq.id} className="border-b border-gray-300 py-3">
                <AccordionTrigger className="flex justify-between items-center text-lg font-medium text-gray-900 hover:no-underline [&>svg]:hidden">
                  {faq.question}
                  <div className="w-5 h-5 border border-gray-400 rounded-full flex-shrink-0 ml-4" />
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 text-base pt-2 pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}