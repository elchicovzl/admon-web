"use client"

import { useState, useRef, MouseEvent, useEffect } from "react"
import { motion, useInView } from "motion/react"
import { Hospital, PiggyBank, HardHat, Home } from "lucide-react"
import { useSmoothScroll } from "@/hooks/use-smooth-scroll"

interface Affiliation {
  icon: typeof Hospital
  title: string
  description: string
  gradientFrom: string
  gradientVia: string
  gradientTo: string
  borderFrom: string
  borderTo: string
  iconBg: string
}

// Generate random particles for card backgrounds
const generateParticles = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 2,
  }))
}

// Interactive 3D Card Component
function InteractiveCard({ affiliation, index }: { affiliation: Affiliation; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [rotateX, setRotateX] = useState(0)
  const [rotateY, setRotateY] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  // Generate particles only on client to avoid hydration mismatch
  const [particles, setParticles] = useState<Array<{
    id: number;
    left: string;
    top: string;
    delay: number;
    duration: number;
  }>>([])

  useEffect(() => {
    // Generate particles only on client side
    setParticles(generateParticles(8))
  }, [])

  const Icon = affiliation.icon

  // Calculate 3D tilt based on mouse position
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return

    const rect = cardRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    const tiltX = (y - 0.5) * -20 // Max ±10deg tilt
    const tiltY = (x - 0.5) * 20

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
        hidden: { opacity: 0, y: 50, scale: 0.9 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            type: "spring",
            stiffness: 100,
            damping: 12,
            delay: index * 0.15,
          },
        },
      }}
    >
      {/* Animated Gradient Border */}
      <div className="relative rounded-3xl p-[2px] overflow-hidden">
        {/* Rotating gradient border */}
        <div
          className="absolute inset-0 rounded-3xl opacity-75 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `linear-gradient(135deg, ${affiliation.borderFrom}, ${affiliation.borderTo}, ${affiliation.borderFrom})`,
            backgroundSize: "200% 200%",
            animation: "gradient-rotate 4s linear infinite",
          }}
        />

        {/* Card Content */}
        <motion.div
          className="relative h-full rounded-3xl overflow-hidden"
          style={{
            rotateX,
            rotateY,
            transformStyle: "preserve-3d",
          }}
          animate={{
            scale: isHovered ? 1.05 : 1,
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20,
          }}
        >
          {/* Gradient Background */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${affiliation.gradientFrom}, ${affiliation.gradientVia}, ${affiliation.gradientTo})`,
            }}
          />

          {/* Glassmorphism Overlay */}
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

          {/* Floating Particles */}
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute w-2 h-2 rounded-full bg-white/20"
              style={{
                left: particle.left,
                top: particle.top,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.2, 0.5, 0.2],
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: particle.duration,
                delay: particle.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}

          {/* Card Content */}
          <div className="relative z-10 p-8 h-full flex flex-col">
            {/* Icon */}
            <motion.div
              className="mb-6"
              animate={{
                rotate: isHovered ? 360 : 0,
                scale: isHovered ? 1.2 : 1,
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
              }}
            >
              <div
                className={`inline-flex p-4 ${affiliation.iconBg} rounded-2xl shadow-2xl`}
              >
                <Icon className="w-10 h-10 text-white" />
              </div>
            </motion.div>

            {/* Title */}
            <h3 className="text-2xl font-black text-white mb-4 tracking-tight">
              {affiliation.title}
            </h3>

            {/* Description */}
            <p className="text-base text-white/90 leading-relaxed flex-grow">
              {affiliation.description}
            </p>

            {/* Decorative Corner Element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

export function SecuritySocialSection() {
  const containerRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(containerRef, { once: true, amount: 0.2 })
  const { scrollToSection } = useSmoothScroll()

  const affiliations: Affiliation[] = [
    {
      icon: Hospital,
      title: "Salud (EPS)",
      description:
        "Te afiliamos a la EPS de tu elección para que tú y tu familia tengan acceso oportuno a servicios médicos.",
      gradientFrom: "rgb(59, 130, 246)", // blue-500
      gradientVia: "rgb(37, 99, 235)", // blue-600
      gradientTo: "rgb(6, 182, 212)", // cyan-500
      borderFrom: "rgb(96, 165, 250)", // blue-400
      borderTo: "rgb(34, 211, 238)", // cyan-400
      iconBg: "bg-blue-500",
    },
    {
      icon: PiggyBank,
      title: "Pensión (AFP)",
      description:
        "Aseguramos tu futuro, gestionando tu vinculación al fondo de pensiones que prefieras, sea Colpensiones o un fondo privado.",
      gradientFrom: "rgb(16, 185, 129)", // emerald-500
      gradientVia: "rgb(5, 150, 105)", // green-600
      gradientTo: "rgb(20, 184, 166)", // teal-500
      borderFrom: "rgb(52, 211, 153)", // emerald-400
      borderTo: "rgb(45, 212, 191)", // teal-400
      iconBg: "bg-emerald-500",
    },
    {
      icon: HardHat,
      title: "Riesgos Laborales (ARL)",
      description:
        "Protege tus ingresos y tu bienestar. Te afiliamos a una ARL que te cubra ante accidentes o enfermedades derivadas de tu trabajo.",
      gradientFrom: "rgb(168, 85, 247)", // purple-500
      gradientVia: "rgb(124, 58, 237)", // violet-600
      gradientTo: "rgb(168, 85, 247)", // purple-500
      borderFrom: "rgb(192, 132, 252)", // purple-400
      borderTo: "rgb(167, 139, 250)", // violet-400
      iconBg: "bg-purple-500",
    },
    {
      icon: Home,
      title: "Caja de Compensación (CajaCF)",
      description:
        "Accede a un mundo de beneficios como subsidios, créditos, recreación y programas de vivienda.",
      gradientFrom: "rgb(244, 63, 94)", // rose-500
      gradientVia: "rgb(234, 88, 12)", // orange-600
      gradientTo: "rgb(249, 115, 22)", // orange-500
      borderFrom: "rgb(251, 113, 133)", // rose-400
      borderTo: "rgb(251, 146, 60)", // orange-400
      iconBg: "bg-rose-500",
    },
  ]

  return (
    <section
      ref={containerRef}
      className="relative py-20 bg-gradient-to-b from-background to-muted/30 overflow-hidden"
      id="afiliaciones"
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            Afiliaciones
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary mb-6 tracking-tight">
            Tu Protección Integral en{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-600">
              Seguridad Social
            </span>
          </h2>
          <p className="text-lg md:text-xl text-foreground/70 max-w-3xl mx-auto leading-relaxed">
            Gestionamos tu afiliación a los cuatro pilares fundamentales de la
            seguridad social en Colombia
          </p>
        </motion.div>

        {/* Affiliations Grid - 2x2 on large screens */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.15,
              },
            },
          }}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {affiliations.map((affiliation, index) => (
            <InteractiveCard
              key={affiliation.title}
              affiliation={affiliation}
              index={index}
            />
          ))}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <p className="text-lg text-foreground/80 mb-6">
            ¿Tienes dudas sobre tu afiliación? Estamos aquí para asesorarte
          </p>
          <button
            onClick={() => scrollToSection("contacto")}
            className="group inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full font-bold text-lg hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 cursor-pointer relative overflow-hidden"
          >
            <span className="relative z-10">Solicitar Asesoría Gratuita</span>
            <motion.span
              className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600"
              initial={{ x: "100%" }}
              whileHover={{ x: 0 }}
              transition={{ duration: 0.3 }}
            />
          </button>
        </motion.div>
      </div>

      {/* CSS Keyframes for gradient rotation */}
      <style jsx>{`
        @keyframes gradient-rotate {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        /* Respect reduced motion preference */
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
