'use client'

import type React from "react"
import Link from "next/link"
import { CheckCircle, ArrowRight, Clock, TrendingUp, Star, Shield, FileText, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useSmoothScroll } from "@/hooks/use-smooth-scroll"
import { memo } from "react"

interface ServiceCardProps {
  id: string
  name: string
  description: string
  services: string[]
  isPopular?: boolean
  bgColor: string
  textColor: string
  iconType: 'clock' | 'chart' | 'star' | 'shield' | 'file' | 'heart'
}

const ServiceCard = memo(function ServiceCard({
  id,
  name,
  description,
  services,
  isPopular,
  iconType,
}: ServiceCardProps) {
  const { scrollToSection } = useSmoothScroll()
  const getIcon = (type: 'clock' | 'chart' | 'star' | 'shield' | 'file' | 'heart') => {
    const iconProps = { size: 32, className: "text-brand-navy" }

    switch (type) {
      case 'clock':
        return <Clock {...iconProps} />
      case 'chart':
        return <TrendingUp {...iconProps} />
      case 'star':
        return <Star {...iconProps} />
      case 'shield':
        return <Shield {...iconProps} />
      case 'file':
        return <FileText {...iconProps} />
      case 'heart':
        return <Heart {...iconProps} />
      default:
        return <Clock {...iconProps} />
    }
  }
  return (
    <div className={cn("relative flex flex-col p-8 rounded-2xl shadow-sm border border-gray-200 bg-white h-full")}>
      {isPopular && (
        <div className="absolute -top-3 right-6 bg-brand-gold text-brand-navy text-xs font-bold px-3 py-1 rounded-full flex items-center space-x-1">
          <span className="w-2 h-2 bg-brand-navy rounded-full" />
          <span>Más Solicitado</span>
        </div>
      )}

      <div className="mb-6">
        <div className="mb-4 inline-flex p-3 bg-brand-gold-soft rounded-xl">{getIcon(iconType)}</div>
        <h3 className="text-2xl font-figtree font-bold text-brand-navy mb-2">{name}</h3>
        <p className="text-gray-600 text-sm">{description}</p>
      </div>

      <div className="flex flex-col space-y-3 mb-8">
        <Link href={`/servicios/${id}`}>
          <Button variant="brand" size="lg" className="w-full cursor-pointer">
            Conocer Más
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </Link>
        <Button
          variant="brand-outline"
          size="lg"
          onClick={() => scrollToSection('contacto')}
          className="cursor-pointer"
        >
          Solicitar Cotización
        </Button>
      </div>

      <ul className="space-y-3 text-gray-700 flex-grow">
        {services.map((service, index) => (
          <li key={index} className="flex items-start text-sm">
            <CheckCircle className="w-4 h-4 text-brand-gold mr-2 flex-shrink-0 mt-0.5" />
            <span>{service}</span>
          </li>
        ))}
      </ul>
    </div>
  )
})

export default ServiceCard