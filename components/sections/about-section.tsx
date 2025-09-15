"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Target, Eye, Heart, Shield, Award, Hospital, PiggyBank, HardHat, Home, Handshake, Zap, Users2, Scale } from "lucide-react"
import { useState, useEffect } from "react"

export function AboutSection() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const missionItems = [
    { icon: Hospital, text: "Salud", color: "bg-blue-500" },
    { icon: PiggyBank, text: "Pensión", color: "bg-green-500" },
    { icon: HardHat, text: "Riesgos laborales", color: "bg-purple-500" },
    { icon: Home, text: "Caja de compensación familiar", color: "bg-red-500" },
  ]

  const visionItems = [
    { icon: Award, text: "Liderazgo Regional", color: "bg-orange-500" },
    { icon: Target, text: "Procesos Ágiles", color: "bg-cyan-500" },
    { icon: CheckCircle, text: "Transparencia Legal", color: "bg-emerald-500" },
  ]

  const values = [
    { name: "Confianza", description: "Base fundamental de nuestras relaciones comerciales", icon: Handshake },
    { name: "Eficiencia", description: "Optimización de procesos para mejores resultados", icon: Zap },
    { name: "Responsabilidad", description: "Compromiso total con nuestros clientes", icon: Users2 },
    { name: "Integridad", description: "Transparencia en cada una de nuestras acciones", icon: Scale },
  ]

  return (
    <section className="relative min-h-screen bg-gradient-to-br from-background via-muted/30 to-background overflow-hidden" id="nosotros">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-float" />
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "4s" }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-16 lg:py-24">
        {/* Header Section */}
        <div className={`text-center mb-16 ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}>
          <Badge variant="secondary" className="mb-4 px-4 py-2 text-sm font-medium">
            Quiénes somos
          </Badge>
          <h1 className="text-4xl lg:text-6xl font-bold text-primary mb-6 text-balance">Nosotros</h1>
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent flex-1 max-w-xs" />
            <div className="w-2 h-2 bg-secondary rounded-full" />
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent flex-1 max-w-xs" />
          </div>
          <p className="text-lg lg:text-xl text-foreground/80 max-w-3xl mx-auto leading-relaxed text-pretty">
            Administración segura es una empresa que ofrece servicios de trámites y afiliaciones a trabajadores
            independientes y empresas a la{" "}
            <span className="font-semibold text-primary">SEGURIDAD SOCIAL INTEGRAL</span>
          </p>
        </div>

        {/* Hero Image */}
        <div className={`mb-20 -mx-4 lg:-mx-8 ${isVisible ? "animate-fade-in-up" : "opacity-0"}`} style={{ animationDelay: "0.2s" }}>
          <div className="relative rounded-2xl overflow-hidden shadow-2xl group">
            <img
              src="/images/social.png"
              alt="Equipo profesional de Administración Segura"
              className="w-full h-64 lg:h-96 object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-transparent to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <h3 className="text-white text-xl lg:text-2xl font-bold mb-2">Comprometidos con tu seguridad social</h3>
              <p className="text-white/90 text-sm lg:text-base">
                Más de una década brindando confianza y profesionalismo
              </p>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 mb-20">
          {/* Mission Section */}
          <Card
            className={`group hover:shadow-xl transition-all duration-500 border-0 bg-card/80 backdrop-blur-sm ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
            style={{ animationDelay: "0.4s" }}
          >
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-secondary/10 rounded-xl group-hover:bg-secondary/20 transition-colors duration-300">
                  <Target className="w-6 h-6 text-secondary" />
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold text-primary">Nuestra Misión</h2>
              </div>

              <p className="text-foreground/70 mb-8 leading-relaxed">
                Administración segura es una empresa que ofrece servicios de trámites y afiliaciones a trabajadores
                independientes y empresas a la SEGURIDAD SOCIAL INTEGRAL.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {missionItems.map((item, index) => (
                  <div
                    key={item.text}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors duration-300 group/item"
                    style={{ animationDelay: `${0.6 + index * 0.1}s` }}
                  >
                    <div
                      className={`p-2 ${item.color} rounded-lg group-hover/item:scale-110 transition-transform duration-300`}
                    >
                      <item.icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-medium text-card-foreground">{item.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Vision Section */}
          <Card
            className={`group hover:shadow-xl transition-all duration-500 border-0 bg-card/80 backdrop-blur-sm ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
            style={{ animationDelay: "0.5s" }}
          >
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-accent/10 rounded-xl group-hover:bg-accent/20 transition-colors duration-300">
                  <Eye className="w-6 h-6 text-accent" />
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold text-primary">Visión</h2>
              </div>

              <p className="text-foreground/70 mb-8 leading-relaxed">
                Ser una empresa reconocida a nivel regional y lograr la confianza y credibilidad de empresas e
                independientes en el sector de la seguridad social mediante procesos ágiles, manejo transparente de los
                recursos dentro del marco legal.
              </p>

              <div className="space-y-4">
                {visionItems.map((item, index) => (
                  <div
                    key={item.text}
                    className="flex items-center gap-4 p-4 rounded-lg hover:bg-muted/50 transition-all duration-300 group/item"
                    style={{ animationDelay: `${0.7 + index * 0.1}s` }}
                  >
                    <div
                      className={`p-3 ${item.color} rounded-xl group-hover/item:scale-110 transition-transform duration-300`}
                    >
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-medium text-card-foreground">{item.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Values Section */}
        <Card
          className={`border-0 bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5 backdrop-blur-sm ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
          style={{ animationDelay: "0.6s" }}
        >
          <CardContent className="p-8 lg:p-12">
            <div className="text-center mb-12">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Heart className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold text-primary">Valores</h2>
              </div>
              <p className="text-foreground/70 max-w-2xl mx-auto leading-relaxed">
                En ADMINISTRACIÓN SEGURA, entendemos que la confianza es la base de cada relación. Por eso, nuestros
                procesos y la manera en que nos conectamos con nuestros clientes están guiados por una serie de valores
                fundamentales que definen quiénes somos y cómo trabajamos.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {values.map((value, index) => (
                <div
                  key={value.name}
                  className={`group p-6 rounded-xl bg-card/60 backdrop-blur-sm border border-border/50 hover:border-secondary/30 hover:shadow-lg transition-all duration-500 hover:-translate-y-1 ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
                  style={{ animationDelay: `${0.8 + index * 0.1}s` }}
                >
                  <div className="mb-4">
                    <div className="w-12 h-12 bg-muted/20 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 border border-border/20">
                      <value.icon className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-bold text-primary mb-2">{value.name}</h3>
                  </div>
                  <p className="text-sm text-foreground/60 leading-relaxed">{value.description}</p>
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
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-primary/80 text-white rounded-full font-medium hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer shadow-md">
            <Shield className="w-5 h-5 text-white" />
            <span className="text-white font-semibold">Conoce más sobre nuestros servicios</span>
          </div>
        </div>
      </div>
    </section>
  )
}