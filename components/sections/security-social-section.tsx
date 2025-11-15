"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Hospital, PiggyBank, HardHat, Home } from "lucide-react"
import { useState, useEffect } from "react"
import { useSmoothScroll } from "@/hooks/use-smooth-scroll"

export function SecuritySocialSection() {
  const [isVisible, setIsVisible] = useState(false)
  const { scrollToSection } = useSmoothScroll()

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const affiliations = [
    {
      icon: Hospital,
      title: "Salud (EPS)",
      description: "Te afiliamos a la EPS de tu elección para que tú y tu familia tengan acceso oportuno a servicios médicos.",
      color: "bg-blue-500",
      bgGradient: "from-blue-50 to-blue-100/50"
    },
    {
      icon: PiggyBank,
      title: "Pensión (AFP)",
      description: "Aseguramos tu futuro, gestionando tu vinculación al fondo de pensiones que prefieras, sea Colpensiones o un fondo privado.",
      color: "bg-green-500",
      bgGradient: "from-green-50 to-green-100/50"
    },
    {
      icon: HardHat,
      title: "Riesgos Laborales (ARL)",
      description: "Protege tus ingresos y tu bienestar. Te afiliamos a una ARL que te cubra ante accidentes o enfermedades derivadas de tu trabajo.",
      color: "bg-purple-500",
      bgGradient: "from-purple-50 to-purple-100/50"
    },
    {
      icon: Home,
      title: "Caja de Compensación (CajaCF)",
      description: "Accede a un mundo de beneficios como subsidios, créditos, recreación y programas de vivienda.",
      color: "bg-red-500",
      bgGradient: "from-red-50 to-red-100/50"
    }
  ]

  return (
    <section className="relative py-20 bg-gradient-to-b from-background to-muted/30 overflow-hidden" id="afiliaciones">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-72 h-72 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className={`text-center mb-16 ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}>
          <Badge variant="secondary" className="mb-4 px-4 py-2 text-sm font-medium">
            Afiliaciones
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary mb-6">
            Tu Protección Integral en Seguridad Social
          </h2>
          <p className="text-lg text-foreground/70 max-w-3xl mx-auto leading-relaxed">
            Gestionamos tu afiliación a los cuatro pilares fundamentales de la seguridad social en Colombia
          </p>
        </div>

        {/* Affiliations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {affiliations.map((affiliation, index) => {
            const Icon = affiliation.icon
            return (
              <Card
                key={affiliation.title}
                className={`group relative overflow-hidden border-0 bg-gradient-to-br ${affiliation.bgGradient} hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-6 h-full flex flex-col">
                  {/* Icon */}
                  <div className="mb-6">
                    <div className={`inline-flex p-4 ${affiliation.color} rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {affiliation.title}
                  </h3>
                  <p className="text-sm text-gray-700 leading-relaxed flex-grow">
                    {affiliation.description}
                  </p>

                  {/* Decorative element */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/20 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500" />
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Bottom CTA */}
        <div
          className={`text-center mt-16 ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
          style={{ animationDelay: "0.5s" }}
        >
          <p className="text-lg text-foreground/80 mb-6">
            ¿Tienes dudas sobre tu afiliación? Estamos aquí para asesorarte
          </p>
          <button
            onClick={() => scrollToSection('contacto')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer"
          >
            Solicitar Asesoría Gratuita
          </button>
        </div>
      </div>
    </section>
  )
}
