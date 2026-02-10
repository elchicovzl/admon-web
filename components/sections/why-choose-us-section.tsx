"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shield, Clock, CheckCircle2, AlertTriangle, Lightbulb } from "lucide-react"
import { useState, useEffect } from "react"

export function WhyChooseUsSection() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const benefits = [
    {
      icon: Shield,
      title: "Cumplimiento Normativo Garantizado",
      description: "La tranquilidad de estar siempre al día. Evita dolores de cabeza y posibles sanciones de entidades como la UGPP, Ministerios, EPS, ARL, CCF y Fondos de Pensiones.",
      color: "bg-blue-500",
      iconColor: "text-blue-500",
      bgColor: "bg-blue-50/50",
      image: "/images/benefits/compliance.png"
    },
    {
      icon: Clock,
      title: "Ahorro de Tiempo y Recursos",
      description: "¡Libérate de cargas administrativas! Deja la burocracia en nuestras manos y dedica tu tiempo y energía a lo que realmente importa: tu trabajo o el núcleo de tu negocio.",
      color: "bg-green-500",
      iconColor: "text-green-500",
      bgColor: "bg-green-50/50",
      image: "/images/benefits/time.png"
    },
    {
      icon: CheckCircle2,
      title: "Gestión Eficiente y sin Errores",
      description: "Somos expertos en el sistema de Seguridad Social colombiano. Realizamos las afiliaciones y te entregamos las planillas PILA listas para su pago, de forma correcta y puntual.",
      color: "bg-purple-500",
      iconColor: "text-purple-500",
      bgColor: "bg-purple-50/50",
      image: "/images/benefits/efficiency.png"
    },
    {
      icon: AlertTriangle,
      title: "Reducción Total de Riesgos",
      description: "Una gestión incorrecta puede acarrear multas, intereses por mora y problemas en la prestación de servicios de salud o en tu futura pensión. Con nosotros, ese riesgo desaparece.",
      color: "bg-red-500",
      iconColor: "text-red-500",
      bgColor: "bg-red-50/50",
      image: "/images/benefits/risk.png"
    },
    {
      icon: Lightbulb,
      title: "Asesoría Experta y Permanente",
      description: "No solo gestionamos tus afiliaciones, te asesoramos para que tomes siempre las mejores decisiones sobre tu cobertura y la de tu familia o equipo de trabajo.",
      color: "bg-amber-500",
      iconColor: "text-amber-500",
      bgColor: "bg-amber-50/50",
      image: "/images/benefits/advice.png"
    }
  ]

  return (
    <section className="relative py-20 lg:py-28 bg-gradient-to-br from-white via-orange-50/30 to-blue-50/20 overflow-hidden" id="beneficios">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(37, 99, 235, 0.06) 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className={`text-center mb-16 ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}>
          <Badge variant="outline" className="mb-4 px-4 py-2 text-sm font-medium border-primary/20">
            Ventajas
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            ¿Por Qué Elegirnos?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Los Beneficios de una Administración Segura
          </p>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto mt-4">
            Delegar la gestión de tu seguridad social en nosotros es una decisión estratégica
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon

            // First two cards span full width on larger screens
            const isWideCard = index < 2
            const gridClass = isWideCard ? "md:col-span-1 lg:col-span-1" : "md:col-span-1"

            return (
              <Card
                key={benefit.title}
                className={`group relative overflow-hidden border border-gray-200 hover:border-primary/30 bg-white hover:shadow-xl transition-all duration-500 hover:-translate-y-1 ${gridClass} ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-8 h-full flex flex-col">
                  {/* Icon with background */}
                  <div className={`inline-flex mb-6 p-4 ${benefit.bgColor} rounded-2xl self-start group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`w-8 h-8 ${benefit.iconColor}`} />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-gray-900 mb-4 leading-tight">
                    {benefit.title}
                  </h3>
                  {/* Optional Image */}
                  {benefit.image && (
                    <div className="mb-4 rounded-xl overflow-hidden h-32 w-full relative">
                      <img src={benefit.image} alt={benefit.title} className="object-cover w-full h-full" />
                    </div>
                  )}
                  <p className="text-gray-600 leading-relaxed flex-grow">
                    {benefit.description}
                  </p>

                  {/* Checkmark indicator */}
                  <div className="mt-6 flex items-center text-sm font-medium text-primary">
                    <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center mr-2">
                      <CheckCircle2 className="w-3 h-3 text-primary" />
                    </div>
                    Incluido
                  </div>

                  {/* Decorative gradient */}
                  <div className={`absolute bottom-0 left-0 right-0 h-1 ${benefit.color} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left`} />
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Bottom section with stats or additional info */}
        <div
          className={`mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
          style={{ animationDelay: "0.6s" }}
        >
          <div className="text-center p-6 bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-2xl border border-blue-200/30 shadow-sm">
            <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent mb-2">10+</div>
            <div className="text-gray-600 font-medium">Años de experiencia</div>
          </div>
          <div className="text-center p-6 bg-gradient-to-br from-[#F1AD32]/15 to-[#F1AD32]/5 rounded-2xl border border-[#F1AD32]/20 shadow-sm">
            <div className="text-4xl font-bold text-[#F1AD32] mb-2">1,000+</div>
            <div className="text-gray-600 font-medium">Clientes satisfechos</div>
          </div>
          <div className="text-center p-6 bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-2xl border border-green-200/30 shadow-sm">
            <div className="text-4xl font-bold bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent mb-2">100%</div>
            <div className="text-gray-600 font-medium">Cumplimiento normativo</div>
          </div>
        </div>
      </div>
    </section>
  )
}
