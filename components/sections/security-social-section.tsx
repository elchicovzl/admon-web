"use client"

import { useState, useRef, MouseEvent, useEffect } from "react"
import { motion, useInView } from "motion/react"
import { Hospital, PiggyBank, HardHat, Home } from "lucide-react"
import { useSmoothScroll } from "@/hooks/use-smooth-scroll"
import { Button } from "@/components/ui/button"
import { SectionLabel } from "@/components/ui/section-label"

interface Affiliation {
  icon: typeof Hospital
  title: string
  description: string
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
      {/* Card border */}
      <div className="relative rounded-2xl overflow-hidden">
        {/* Card Content */}
        <motion.div
          className="relative h-full rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-sm group-hover:border-brand-gold/60 transition-colors duration-300"
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
            stiffness: 300,
            damping: 20,
          }}
        >
          {/* Floating Particles */}
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute w-2 h-2 rounded-full bg-brand-gold/20"
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
              <div className="inline-flex p-4 bg-brand-gold-soft text-brand-navy rounded-2xl">
                <Icon className="w-10 h-10" />
              </div>
            </motion.div>

            {/* Title */}
            <h4 className="text-2xl font-figtree font-bold text-brand-navy mb-4 tracking-tight">
              {affiliation.title}
            </h4>

            {/* Description */}
            <p className="text-base text-gray-600 leading-relaxed flex-grow">
              {affiliation.description}
            </p>

            {/* Decorative Corner Element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold-soft rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
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
    },
    {
      icon: PiggyBank,
      title: "Pensión (AFP)",
      description:
        "Aseguramos tu futuro, gestionando tu vinculación al fondo de pensiones que prefieras, sea Colpensiones o un fondo privado.",
    },
    {
      icon: HardHat,
      title: "Riesgos Laborales (ARL)",
      description:
        "Protege tus ingresos y tu bienestar. Te afiliamos a una ARL que te cubra ante accidentes o enfermedades derivadas de tu trabajo.",
    },
    {
      icon: Home,
      title: "Caja de Compensación (CajaCF)",
      description:
        "Accede a un mundo de beneficios como subsidios, créditos, recreación y programas de vivienda.",
    },
  ]

  return (
    <section
      ref={containerRef}
      className="relative py-20 bg-white overflow-hidden"
      id="afiliaciones"
    >
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <SectionLabel className="mb-4">Afiliaciones</SectionLabel>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-figtree font-bold text-brand-navy mb-6 tracking-tight">
            Tu Protección Integral en{" "}
            <span className="text-brand-gold">
              Seguridad Social
            </span>
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
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
          <p className="text-lg text-gray-700 mb-6">
            ¿Tienes dudas sobre tu afiliación? Estamos aquí para asesorarte
          </p>
          <Button
            variant="brand"
            size="xl"
            onClick={() => scrollToSection("contacto")}
            className="cursor-pointer"
          >
            Solicitar Asesoría Gratuita
          </Button>
        </motion.div>
      </div>

      {/* CSS for reduced motion */}
      <style jsx>{`
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
