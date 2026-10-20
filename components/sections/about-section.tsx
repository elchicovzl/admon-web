"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { SectionLabel } from "@/components/ui/section-label"
import { Shield } from "lucide-react"
import { useState, useEffect } from "react"
import { MissionVision } from "@/components/sections/about/mission-vision"
import { ValuesBento } from "@/components/sections/about/values-bento"
import { useSmoothScroll } from "@/hooks/use-smooth-scroll"

export function AboutSection() {
  const [isVisible, setIsVisible] = useState(false)
  const { scrollToSection } = useSmoothScroll()

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <section className="relative min-h-screen bg-surface-muted overflow-hidden" id="nosotros">
      <div className="relative z-10 container mx-auto px-4 py-16 lg:py-24">
        {/* Header Section - copy + team image */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center mb-20">
          <div className={`text-center lg:text-left ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}>
            <SectionLabel className="mb-4">Quiénes somos</SectionLabel>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-figtree font-bold text-brand-navy mb-6 text-balance">Nosotros</h1>
            <div className="flex items-center justify-center lg:justify-start gap-4 mb-8">
              <div className="w-12 h-1 bg-brand-gold rounded-full" />
              <div className="w-2 h-2 bg-brand-gold rounded-full" />
            </div>
            <p className="text-lg lg:text-xl text-gray-700 leading-relaxed text-pretty">
              En Administración Segura te ofrecemos el respaldo que necesitas para que alcances tus
              metas con total seguridad. Creamos alianzas estratégicas para brindarte un acompañamiento
              integral en tu afiliación a la{" "}
              <span className="font-semibold text-brand-navy">Seguridad Social (SSI)</span> y otros servicios complementarios.
            </p>
            <p className="text-base lg:text-lg text-gray-600 leading-relaxed text-pretty mt-4">
              Gracias a nuestra optimización de procesos y el uso de tecnología, te garantizamos tarifas
              competitivas y un servicio ágil y confiable. Nuestra prioridad es orientarte para que tomes
              las mejores decisiones y accedas a todos los beneficios que tenemos para ti.
            </p>
            <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
              <div className="p-2 bg-brand-gold-soft text-brand-navy rounded-xl">
                <Shield className="w-5 h-5" />
              </div>
              <p className="text-sm text-left text-gray-700">
                <span className="font-bold text-brand-navy">Comprometidos con tu seguridad social.</span>{" "}
                Más de una década brindando confianza y profesionalismo.
              </p>
            </div>
          </div>

          <div
            className={`relative ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
            style={{ animationDelay: "0.2s" }}
          >
            <div className="absolute inset-x-8 bottom-4 top-12 bg-brand-gold/15 rounded-full blur-3xl pointer-events-none" />
            <Image
              src="/images/hero-team.webp"
              alt="Equipo de Administración Segura: afiliaciones, ARL, incapacidades y pensión"
              width={1448}
              height={1086}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="relative w-full h-auto"
            />
          </div>
        </div>

        {/* Mission & Vision */}
        <MissionVision />

        {/* Values */}
        <ValuesBento />

        {/* Call to Action */}
        <div
          className={`text-center mt-16 ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
          style={{ animationDelay: "1s" }}
        >
          <Button
            variant="brand"
            size="xl"
            onClick={() => scrollToSection('contacto')}
            className="cursor-pointer"
          >
            <Shield className="w-6 h-6" />
            <span className="text-xs md:text-sm">Conoce más sobre nuestros servicios</span>
          </Button>
        </div>
      </div>
    </section>
  )
}
