"use client"

import { useState, useRef, MouseEvent } from "react"
import { motion, useInView } from "motion/react"
import { Shield, Clock, CheckCircle2, AlertTriangle, Lightbulb, TrendingUp, Users, Award } from "lucide-react"

interface Benefit {
  icon: typeof Shield
  title: string
  description: string
  gradientFrom: string
  gradientTo: string
  iconBg: string
}

// Interactive Benefit Card Component
function BenefitCard({ benefit, index }: { benefit: Benefit; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [rotateX, setRotateX] = useState(0)
  const [rotateY, setRotateY] = useState(0)
  const [isHovered, setIsHovered] = useState(false)

  const Icon = benefit.icon

  // Calculate subtle 3D tilt based on mouse position
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return

    const rect = cardRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    const tiltX = (y - 0.5) * -10 // Max ±5deg tilt (lighter than Afiliaciones)
    const tiltY = (x - 0.5) * 10

    setRotateX(tiltX)
    setRotateY(tiltY)
  }

  const handleMouseLeave = () => {
    setRotateX(0)
    setRotateY(0)
    setIsHovered(false)
  }

  return (
    <motion.div
      ref={cardRef}
      className="group relative"
      style={{ perspective: "1000px" }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      variants={{
        hidden: { opacity: 0, y: 30, scale: 0.95 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            type: "spring",
            stiffness: 100,
            damping: 15,
            delay: index * 0.1,
          },
        },
      }}
    >
      {/* Glow Border Effect */}
      <div
        className={`absolute -inset-[2px] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
      >
        <div
          className="absolute inset-0 blur-xl"
          style={{
            background: `linear-gradient(135deg, ${benefit.gradientFrom}, ${benefit.gradientTo})`,
          }}
        />
      </div>

      {/* Card Content */}
      <motion.div
        className="relative h-full rounded-2xl overflow-hidden bg-white/5 backdrop-blur-lg border border-white/10"
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        animate={{
          scale: isHovered ? 1.03 : 1,
        }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 15,
        }}
      >
        <div className="relative z-10 p-8 h-full flex flex-col">
          {/* Icon */}
          <motion.div
            className="mb-6"
            animate={{
              scale: isHovered ? 1.15 : 1,
              rotate: isHovered ? 5 : 0,
            }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 15,
            }}
          >
            <div
              className={`inline-flex p-4 ${benefit.iconBg} rounded-2xl shadow-xl`}
            >
              <Icon className="w-8 h-8 text-white" />
            </div>
          </motion.div>

          {/* Title */}
          <h3 className="text-xl font-black text-white mb-4 tracking-tight">
            {benefit.title}
          </h3>

          {/* Description */}
          <p className="text-base text-white/90 leading-relaxed flex-grow">
            {benefit.description}
          </p>

          {/* Checkmark indicator */}
          <div className="mt-6 flex items-center text-sm font-medium text-white/80">
            <div className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center mr-2">
              <CheckCircle2 className="w-3 h-3 text-white" />
            </div>
            Incluido
          </div>

          {/* Decorative gradient corner */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500" />
        </div>
      </motion.div>
    </motion.div>
  )
}

// Stats Card Component
function StatCard({
  icon: Icon,
  value,
  label,
  gradientFrom,
  gradientTo,
  delay,
}: {
  icon: typeof TrendingUp
  value: string
  label: string
  gradientFrom: string
  gradientTo: string
  delay: number
}) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <motion.div
      className="group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
    >
      {/* Subtle glow effect on hover only */}
      <div
        className="absolute -inset-[1px] rounded-2xl opacity-0 group-hover:opacity-40 transition-opacity duration-300"
      >
        <div
          className="absolute inset-0 blur-md"
          style={{
            background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
          }}
        />
      </div>

      {/* Card */}
      <motion.div
        className="relative p-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-center"
        animate={{
          scale: isHovered ? 1.03 : 1,
        }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 15,
        }}
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div
            className="p-3 rounded-xl shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
            }}
          >
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Number - solid white for better readability */}
        <div className="text-5xl font-black mb-2 text-white">
          {value}
        </div>

        {/* Label */}
        <div className="text-white/90 font-medium">{label}</div>
      </motion.div>
    </motion.div>
  )
}

export function WhyChooseUsSection() {
  const containerRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(containerRef, { once: true, amount: 0.2 })

  const benefits: Benefit[] = [
    {
      icon: Shield,
      title: "Cumplimiento Normativo Garantizado",
      description:
        "La tranquilidad de estar siempre al día. Evita dolores de cabeza y posibles sanciones de entidades como la UGPP, Ministerios, EPS, ARL, CCF y Fondos de Pensiones.",
      gradientFrom: "rgb(59, 130, 246)", // blue-500
      gradientTo: "rgb(34, 211, 238)", // cyan-400
      iconBg: "bg-gradient-to-br from-blue-500 to-cyan-400",
    },
    {
      icon: Clock,
      title: "Ahorro de Tiempo y Recursos",
      description:
        "¡Libérate de cargas administrativas! Deja la burocracia en nuestras manos y dedica tu tiempo y energía a lo que realmente importa: tu trabajo o el núcleo de tu negocio.",
      gradientFrom: "rgb(16, 185, 129)", // emerald-500
      gradientTo: "rgb(45, 212, 191)", // teal-400
      iconBg: "bg-gradient-to-br from-emerald-500 to-teal-400",
    },
    {
      icon: CheckCircle2,
      title: "Gestión Eficiente y sin Errores",
      description:
        "Somos expertos en el sistema de Seguridad Social colombiano. Realizamos las afiliaciones y te entregamos las planillas PILA listas para su pago, de forma correcta y puntual.",
      gradientFrom: "rgb(168, 85, 247)", // purple-500
      gradientTo: "rgb(167, 139, 250)", // violet-400
      iconBg: "bg-gradient-to-br from-purple-500 to-violet-400",
    },
    {
      icon: AlertTriangle,
      title: "Reducción Total de Riesgos",
      description:
        "Una gestión incorrecta puede acarrear multas, intereses por mora y problemas en la prestación de servicios de salud o en tu futura pensión. Con nosotros, ese riesgo desaparece.",
      gradientFrom: "rgb(244, 63, 94)", // rose-500
      gradientTo: "rgb(249, 115, 22)", // orange-500
      iconBg: "bg-gradient-to-br from-rose-500 to-orange-500",
    },
    {
      icon: Lightbulb,
      title: "Asesoría Experta y Permanente",
      description:
        "No solo gestionamos tus afiliaciones, te asesoramos para que tomes siempre las mejores decisiones sobre tu cobertura y la de tu familia o equipo de trabajo.",
      gradientFrom: "rgb(245, 158, 11)", // amber-500
      gradientTo: "rgb(251, 146, 60)", // orange-400
      iconBg: "bg-gradient-to-br from-amber-500 to-orange-400",
    },
  ]

  return (
    <section
      ref={containerRef}
      className="relative py-20 lg:py-28 bg-gradient-to-br from-[#020617] via-[#1e3a8a] to-[#172554] overflow-hidden"
      id="beneficios"
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-20 -right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm font-medium mb-4 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            Ventajas
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
            ¿Por Qué{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">
              Elegirnos?
            </span>
          </h2>
          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto leading-relaxed mb-2">
            Los Beneficios de una Administración Segura
          </p>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            Delegar la gestión de tu seguridad social en nosotros es una decisión estratégica
          </p>
        </motion.div>

        {/* Benefits Grid - 2 columns then 3 columns */}
        <motion.div
          className="max-w-6xl mx-auto mb-20"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1,
              },
            },
          }}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {/* First row: 2 cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {benefits.slice(0, 2).map((benefit, index) => (
              <BenefitCard key={benefit.title} benefit={benefit} index={index} />
            ))}
          </div>

          {/* Second row: 3 cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.slice(2).map((benefit, index) => (
              <BenefitCard
                key={benefit.title}
                benefit={benefit}
                index={index + 2}
              />
            ))}
          </div>
        </motion.div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <StatCard
            icon={TrendingUp}
            value="5+"
            label="Años de experiencia"
            gradientFrom="rgb(59, 130, 246)"
            gradientTo="rgb(37, 99, 235)"
            delay={0.6}
          />
          <StatCard
            icon={Users}
            value="500+"
            label="Clientes satisfechos"
            gradientFrom="rgb(245, 158, 11)"
            gradientTo="rgb(251, 146, 60)"
            delay={0.7}
          />
          <StatCard
            icon={Award}
            value="100%"
            label="Cumplimiento normativo"
            gradientFrom="rgb(16, 185, 129)"
            gradientTo="rgb(5, 150, 105)"
            delay={0.8}
          />
        </div>
      </div>

      {/* CSS for reduced motion */}
      <style jsx>{`
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </section>
  )
}
