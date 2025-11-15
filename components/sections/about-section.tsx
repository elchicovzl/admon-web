"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
    { icon: Hospital, text: "Salud", gradient: "from-blue-400 to-blue-600", shadowColor: "rgba(59, 130, 246, 0.4)" },
    { icon: PiggyBank, text: "Pensión", gradient: "from-green-400 to-green-600", shadowColor: "rgba(34, 197, 94, 0.4)" },
    { icon: HardHat, text: "Riesgos laborales", gradient: "from-purple-400 to-purple-600", shadowColor: "rgba(168, 85, 247, 0.4)" },
    { icon: Home, text: "Caja de compensación familiar", gradient: "from-red-400 to-red-600", shadowColor: "rgba(239, 68, 68, 0.4)" },
  ]

  const visionItems = [
    { icon: Award, text: "Liderazgo Regional", gradient: "from-orange-400 to-orange-600", glowColor: "rgba(251, 146, 60, 0.3)" },
    { icon: Target, text: "Procesos Ágiles", gradient: "from-cyan-400 to-cyan-600", glowColor: "rgba(34, 211, 238, 0.3)" },
    { icon: CheckCircle, text: "Transparencia Legal", gradient: "from-emerald-400 to-emerald-600", glowColor: "rgba(52, 211, 153, 0.3)" },
  ]

  const values = [
    { name: "Confianza", description: "Base fundamental de nuestras relaciones comerciales", icon: Handshake },
    { name: "Eficiencia", description: "Optimización de procesos para mejores resultados", icon: Zap },
    { name: "Responsabilidad", description: "Compromiso total con nuestros clientes", icon: Users2 },
    { name: "Integridad", description: "Transparencia en cada una de nuestras acciones", icon: Scale },
  ]

  return (
    <section className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 overflow-hidden" id="nosotros">
      {/* Enhanced Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl animate-float" />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-green-400/20 to-cyan-400/20 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-orange-400/10 to-pink-400/10 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "4s" }}
        />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(0,0,0,0.15) 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-16 lg:py-24">
        {/* Header Section */}
        <div className={`text-center mb-16 ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}>
          <Badge variant="secondary" className="mb-4 px-4 py-2 text-sm font-medium shadow-lg">
            Quiénes somos
          </Badge>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-6 text-balance">Nosotros</h1>
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent flex-1 max-w-xs" />
            <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
            <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent flex-1 max-w-xs" />
          </div>
          <p className="text-lg lg:text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed text-pretty">
            En Administración Segura te ofrecemos el respaldo que necesitas para que alcances tus
            metas con total seguridad. Creamos alianzas estratégicas para brindarte un acompañamiento
            integral en tu afiliación a la{" "}
            <span className="font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Seguridad Social (SSI)</span> y otros servicios complementarios.
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
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/40 to-transparent" />
            <div className="absolute bottom-8 left-8 right-8">
              <h3 className="text-white text-xl lg:text-3xl font-bold mb-2">Comprometidos con tu seguridad social</h3>
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
            <Card className="relative overflow-hidden border-0 bg-white/80 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-500 h-full">
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <CardContent className="p-8 lg:p-10 relative z-10">
                {/* Glass effect icon */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl blur-xl opacity-50 animate-pulse-glow" />
                    <div className="relative glass-effect-strong p-4 rounded-2xl">
                      <Target className="w-8 h-8 text-blue-600" />
                    </div>
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
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
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-200/50 hover:border-transparent hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                        <div className="relative flex-shrink-0">
                          {/* Glow effect */}
                          <div
                            className="absolute inset-0 rounded-xl blur-md opacity-0 group-hover/item:opacity-100 transition-opacity duration-300"
                            style={{
                              background: `linear-gradient(to bottom right, ${item.shadowColor})`,
                            }}
                          />
                          <div className={`relative p-3 bg-gradient-to-br ${item.gradient} rounded-xl shadow-md group-hover/item:scale-110 transition-transform duration-300`}>
                            <item.icon className="w-5 h-5 text-white" />
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
            <Card className="relative overflow-hidden border-0 bg-white/80 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-500 h-full">
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <CardContent className="p-8 lg:p-10 relative z-10">
                {/* Glass effect icon */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-pink-600 rounded-2xl blur-xl opacity-50 animate-pulse-glow" />
                    <div className="relative glass-effect-strong p-4 rounded-2xl">
                      <Eye className="w-8 h-8 text-orange-600" />
                    </div>
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
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
                        {/* Glow effect */}
                        <div
                          className="absolute inset-0 rounded-2xl blur-lg opacity-0 group-hover/item:opacity-100 transition-opacity duration-300"
                          style={{ boxShadow: `0 0 30px ${item.glowColor}` }}
                        />
                        <div className={`relative p-4 bg-gradient-to-br ${item.gradient} rounded-2xl shadow-lg group-hover/item:scale-110 transition-transform duration-300`}>
                          <item.icon className="w-5 h-5 text-white" />
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
          className={`relative overflow-hidden border-0 bg-gradient-to-br from-white via-gray-50 to-blue-50/30 backdrop-blur-sm shadow-xl ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
          style={{ animationDelay: "0.7s" }}
        >
          {/* Decorative overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-50" />

          <CardContent className="p-8 lg:p-12 relative z-10">
            <div className="text-center mb-12">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl blur-xl opacity-40" />
                  <div className="relative p-3 glass-effect-strong rounded-2xl">
                    <Heart className="w-7 h-7 text-rose-600" />
                  </div>
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Valores</h2>
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
                  <div className="relative h-full p-6 rounded-2xl bg-white border border-gray-200/50 hover:border-blue-200 hover:shadow-xl transition-all duration-500 hover:-translate-y-2">
                    {/* Gradient overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    <div className="relative z-10">
                      <div className="mb-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-md">
                          <value.icon className="w-7 h-7 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{value.name}</h3>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">{value.description}</p>
                    </div>

                    {/* Bottom gradient line */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-b-2xl" />
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
          <button
            onClick={() => scrollToSection('contacto')}
            className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full font-semibold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden"
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer" />

            <Shield className="w-6 h-6 relative z-10" />
            <span className="relative z-10 text-xs md:text-sm">Conoce más sobre nuestros servicios</span>
          </button>
        </div>
      </div>
    </section>
  )
}
