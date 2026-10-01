"use client"

import { useState, useRef, MouseEvent } from "react"
import { motion, useInView } from "motion/react"
import { Shield, Clock, CheckCircle2, AlertTriangle, Lightbulb, TrendingUp, Users, Award } from "lucide-react"
import { SectionLabel } from "@/components/ui/section-label"

interface Benefit {
  icon: typeof Shield
  title: string
  description: string
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
      {/* Card Content */}
      <motion.div
        className="relative h-full rounded-2xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-brand-gold/40 transition-colors duration-300"
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
            <div className="inline-flex p-4 bg-brand-gold/15 text-brand-gold rounded-2xl">
              <Icon className="w-8 h-8" />
            </div>
          </motion.div>

          {/* Title */}
          <h4 className="text-xl font-figtree font-bold text-white mb-4 tracking-tight">
            {benefit.title}
          </h4>

          {/* Description */}
          <p className="text-base text-white/80 leading-relaxed flex-grow">
            {benefit.description}
          </p>

          {/* Checkmark indicator */}
          <div className="mt-6 flex items-center text-sm font-medium text-white/80">
            <div className="w-5 h-5 bg-brand-gold/15 rounded-full flex items-center justify-center mr-2">
              <CheckCircle2 className="w-3 h-3 text-brand-gold" />
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
  delay,
}: {
  icon: typeof TrendingUp
  value: string
  label: string
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
      {/* Card */}
      <motion.div
        className="relative p-8 bg-white/5 border border-white/10 rounded-2xl text-center"
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
          <div className="p-3 rounded-xl bg-brand-gold/15 text-brand-gold">
            <Icon className="w-6 h-6" />
          </div>
        </div>

        {/* Number */}
        <div className="text-5xl font-figtree font-bold mb-2 text-brand-gold">
          {value}
        </div>

        {/* Label */}
        <div className="text-white/80 font-medium">{label}</div>
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
    },
    {
      icon: Clock,
      title: "Ahorro de Tiempo y Recursos",
      description:
        "¡Libérate de cargas administrativas! Deja la burocracia en nuestras manos y dedica tu tiempo y energía a lo que realmente importa: tu trabajo o el núcleo de tu negocio.",
    },
    {
      icon: CheckCircle2,
      title: "Gestión Eficiente y sin Errores",
      description:
        "Somos expertos en el sistema de Seguridad Social colombiano. Realizamos las afiliaciones y te entregamos las planillas PILA listas para su pago, de forma correcta y puntual.",
    },
    {
      icon: AlertTriangle,
      title: "Reducción Total de Riesgos",
      description:
        "Una gestión incorrecta puede acarrear multas, intereses por mora y problemas en la prestación de servicios de salud o en tu futura pensión. Con nosotros, ese riesgo desaparece.",
    },
    {
      icon: Lightbulb,
      title: "Asesoría Experta y Permanente",
      description:
        "No solo gestionamos tus afiliaciones, te asesoramos para que tomes siempre las mejores decisiones sobre tu cobertura y la de tu familia o equipo de trabajo.",
    },
  ]

  return (
    <section
      ref={containerRef}
      className="relative py-20 lg:py-28 bg-gradient-to-br from-brand-navy to-brand-navy-deep overflow-hidden"
      id="beneficios"
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-brand-gold/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <SectionLabel tone="dark" className="mb-4">Ventajas</SectionLabel>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-figtree font-bold text-white mb-6 tracking-tight">
            ¿Por Qué{" "}
            <span className="text-brand-gold">
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
            value="7+"
            label="Años de experiencia"
            delay={0.6}
          />
          <StatCard
            icon={Users}
            value="500+"
            label="Clientes satisfechos"
            delay={0.7}
          />
          <StatCard
            icon={Award}
            value="100%"
            label="Cumplimiento normativo"
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
