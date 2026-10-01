"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SectionLabel } from "@/components/ui/section-label"
import { CheckCircle, Target, Eye, Heart, Shield, Award, Hospital, PiggyBank, HardHat, Home, Handshake, Zap, Users2, Scale } from "lucide-react"
import { useState, useEffect } from "react"
import { useSmoothScroll } from "@/hooks/use-smooth-scroll"

export function AboutSection() {
  const [isVisible, setIsVisible] = useState(false)
  const { scrollToSection } = useSmoothScroll()

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const missionItems = [
    { icon: Hospital, text: "Salud" },
    { icon: PiggyBank, text: "Pensión" },
    { icon: HardHat, text: "Riesgos laborales" },
    { icon: Home, text: "Caja de compensación familiar" },
  ]

  const visionItems = [
    { icon: Award, text: "Liderazgo Regional" },
    { icon: Target, text: "Procesos Ágiles" },
    { icon: CheckCircle, text: "Transparencia Legal" },
  ]

  const values = [
    { name: "Confianza", description: "Base fundamental de nuestras relaciones comerciales", icon: Handshake },
    { name: "Eficiencia", description: "Optimización de procesos para mejores resultados", icon: Zap },
    { name: "Responsabilidad", description: "Compromiso total con nuestros clientes", icon: Users2 },
    { name: "Integridad", description: "Transparencia en cada una de nuestras acciones", icon: Scale },
  ]

  return (
    <section className="relative min-h-screen bg-surface-muted overflow-hidden" id="nosotros">
      <div className="relative z-10 container mx-auto px-4 py-16 lg:py-24">
        {/* Header Section */}
        <div className={`text-center mb-16 ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}>
          <SectionLabel className="mb-4">Quiénes somos</SectionLabel>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-figtree font-bold text-brand-navy mb-6 text-balance">Nosotros</h1>
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent flex-1 max-w-xs" />
            <div className="w-2 h-2 bg-brand-gold rounded-full" />
            <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent flex-1 max-w-xs" />
          </div>
          <p className="text-lg lg:text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed text-pretty">
            En Administración Segura te ofrecemos el respaldo que necesitas para que alcances tus
            metas con total seguridad. Creamos alianzas estratégicas para brindarte un acompañamiento
            integral en tu afiliación a la{" "}
            <span className="font-semibold text-brand-navy">Seguridad Social (SSI)</span> y otros servicios complementarios.
          </p>
          <p className="text-base lg:text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed text-pretty mt-4">
            Gracias a nuestra optimización de procesos y el uso de tecnología, te garantizamos tarifas
            competitivas y un servicio ágil y confiable. Nuestra prioridad es orientarte para que tomes
            las mejores decisiones y accedas a todos los beneficios que tenemos para ti.
          </p>
        </div>

        {/* Hero Image */}
        <div className={`mb-20 -mx-4 lg:-mx-8 ${isVisible ? "animate-fade-in-up" : "opacity-0"}`} style={{ animationDelay: "0.2s" }}>
          <div className="relative rounded-3xl overflow-hidden shadow-2xl group">
            <img
              src="/images/social.png"
              alt="Equipo profesional de Administración Segura"
              className="w-full h-64 lg:h-96 object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-navy-deep/85 via-brand-navy/40 to-transparent" />
            <div className="absolute bottom-8 left-8 right-8">
              <h3 className="text-white text-xl lg:text-3xl font-figtree font-bold mb-2">Comprometidos con tu seguridad social</h3>
              <p className="text-white/90 text-sm lg:text-base">
                Más de una década brindando confianza y profesionalismo
              </p>
            </div>
            {/* Shimmer overlay on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer" />
          </div>
        </div>

        {/* Main Content Grid - Mission & Vision */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 mb-20">
          {/* Mission Section - Enhanced */}
          <div
            className={`relative group ${isVisible ? "animate-slide-in-left" : "opacity-0"}`}
            style={{ animationDelay: "0.3s" }}
          >
            <Card className="relative overflow-hidden border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-500 h-full">

              <CardContent className="p-8 lg:p-10 relative z-10">
                {/* Glass effect icon */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-4 bg-brand-gold-soft text-brand-navy rounded-2xl">
                    <Target className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-figtree font-bold text-brand-navy">
                    Nuestra Misión
                  </h2>
                </div>

                <p className="text-gray-700 mb-10 leading-relaxed text-lg">
                  Brindar acompañamiento integral en la afiliación a la Seguridad Social y servicios complementarios,
                  creando alianzas estratégicas que garanticen tarifas competitivas y un servicio ágil mediante la
                  optimización de procesos y el uso de tecnología.
                </p>

                {/* Mission items with enhanced design */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {missionItems.map((item, index) => (
                    <div
                      key={item.text}
                      className={`group/item relative ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
                      style={{ animationDelay: `${0.5 + index * 0.1}s` }}
                    >
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-200 hover:border-brand-gold/60 hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                        <div className="relative flex-shrink-0">
                          <div className="relative p-3 bg-brand-gold-soft text-brand-navy rounded-xl group-hover/item:scale-110 transition-transform duration-300">
                            <item.icon className="w-5 h-5" />
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-gray-800 leading-tight">{item.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Vision Section - Enhanced */}
          <div
            className={`relative group ${isVisible ? "animate-slide-in-right" : "opacity-0"}`}
            style={{ animationDelay: "0.4s" }}
          >
            <Card className="relative overflow-hidden border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-500 h-full">

              <CardContent className="p-8 lg:p-10 relative z-10">
                {/* Glass effect icon */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-4 bg-brand-gold-soft text-brand-navy rounded-2xl">
                    <Eye className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-figtree font-bold text-brand-navy">
                    Visión
                  </h2>
                </div>

                <p className="text-gray-700 mb-10 leading-relaxed text-lg">
                  Ser una empresa reconocida a nivel regional y lograr la confianza y credibilidad de empresas e
                  independientes en el sector de la seguridad social mediante procesos ágiles, manejo transparente de los
                  recursos dentro del marco legal.
                </p>

                {/* Vision items with enhanced design */}
                <div className="space-y-4">
                  {visionItems.map((item, index) => (
                    <div
                      key={item.text}
                      className={`group/item flex items-center gap-4 ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
                      style={{ animationDelay: `${0.6 + index * 0.1}s` }}
                    >
                      <div className="relative flex-shrink-0">
                        <div className="relative p-4 bg-brand-gold-soft text-brand-navy rounded-2xl group-hover/item:scale-110 transition-transform duration-300">
                          <item.icon className="w-5 h-5" />
                        </div>
                      </div>
                      <span className="font-bold text-gray-800 text-sm">{item.text}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Values Section - Enhanced */}
        <Card
          className={`relative overflow-hidden border border-gray-200 bg-white shadow-sm ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
          style={{ animationDelay: "0.7s" }}
        >
          <CardContent className="p-8 lg:p-12 relative z-10">
            <div className="text-center mb-12">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="p-3 bg-brand-gold-soft text-brand-navy rounded-2xl">
                    <Heart className="w-7 h-7" />
                  </div>
                <h2 className="text-3xl lg:text-4xl font-figtree font-bold text-brand-navy">Valores</h2>
              </div>
              <p className="text-gray-700 max-w-2xl mx-auto leading-relaxed text-lg">
                En ADMINISTRACIÓN SEGURA, entendemos que la confianza es la base de cada relación. Por eso, nuestros
                procesos y la manera en que nos conectamos con nuestros clientes están guiados por una serie de valores
                fundamentales que definen quiénes somos y cómo trabajamos.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {values.map((value, index) => (
                <div
                  key={value.name}
                  className={`group relative ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
                  style={{ animationDelay: `${0.8 + index * 0.1}s` }}
                >
                  <div className="relative h-full p-6 rounded-2xl bg-white border border-gray-200 hover:border-brand-gold/60 hover:shadow-md transition-all duration-500 hover:-translate-y-2">
                    <div className="relative z-10">
                      <div className="mb-4">
                        <div className="w-14 h-14 bg-brand-gold-soft text-brand-navy rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                          <value.icon className="w-7 h-7" />
                        </div>
                        <h3 className="text-xl font-figtree font-bold text-brand-navy mb-2">{value.name}</h3>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">{value.description}</p>
                    </div>

                    {/* Bottom gradient line */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-gold transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-b-2xl" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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
