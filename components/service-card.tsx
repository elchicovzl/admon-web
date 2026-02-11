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
  bgColor,
  textColor,
  iconType,
}: ServiceCardProps) {
  const { scrollToSection } = useSmoothScroll()
  const getIcon = (type: 'clock' | 'chart' | 'star' | 'shield' | 'file' | 'heart') => {
    const iconProps = { size: 32, className: "text-gray-900" }

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
    <div className={cn("relative flex flex-col p-8 rounded-xl shadow-lg border border-gray-200 h-full", bgColor, textColor)}>
      {isPopular && (
        <div className="absolute -top-3 right-6 bg-black text-white text-xs font-medium px-3 py-1 rounded-full flex items-center space-x-1">
          <span className="w-2 h-2 bg-white rounded-full" />
          <span>Más Solicitado</span>
        </div>
      )}

      <div className="mb-6">
        <div className="mb-4">{getIcon(iconType)}</div>
        <h3 className="text-2xl font-bold mb-2">{name}</h3>
        <p className="text-gray-600 text-sm">{description}</p>
      </div>

      <div className="flex flex-col space-y-3 mb-8">
        <Link href={`/servicios/${id}`}>
          <Button className="bg-black text-white hover:bg-gray-800 rounded-full px-6 py-3 text-base font-medium w-full">
            Conocer Más
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </Link>
        <Button
          variant="outline"
          onClick={() => scrollToSection('contacto')}
          className="rounded-full px-6 py-3 text-base font-medium border-2 border-gray-300 hover:bg-gray-50 bg-transparent text-gray-900"
        >
          Solicitar Cotización
        </Button>
      </div>

      <ul className="space-y-3 text-gray-700 flex-grow">
        {services.map((service, index) => (
          <li key={index} className="flex items-start text-sm">
            <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
            <span>{service}</span>
          </li>
        ))}
      </ul>
    </div>
  )
})

export default ServiceCard