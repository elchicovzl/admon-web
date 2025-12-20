'use client'

import {
  Shield,
  FileText,
  Heart,
  Star,
  Car,
  Stethoscope,
  Umbrella,
  PawPrint,
  Building2,
  Package,
  CheckCircle,
  Clock,
  Zap,
  Headphones,
  Lock,
  BarChart,
  TrendingUp,
  BookOpen,
  DollarSign,
  Users,
  User,
  Home,
  Briefcase,
  Truck,
  Store,
  Plane,
  GraduationCap,
  type LucideIcon
} from 'lucide-react'
import { ServiceIconType } from '@/data/services'

const iconMap: Record<string, LucideIcon> = {
  'shield': Shield,
  'file': FileText,
  'heart': Heart,
  'star': Star,
  'car': Car,
  'stethoscope': Stethoscope,
  'umbrella': Umbrella,
  'paw-print': PawPrint,
  'building-2': Building2,
  'package': Package,
  'check-circle': CheckCircle,
  'clock': Clock,
  'zap': Zap,
  'headphones': Headphones,
  'lock': Lock,
  'bar-chart': BarChart,
  'trending-up': TrendingUp,
  'book-open': BookOpen,
  'dollar-sign': DollarSign,
  'users': Users,
  'user': User,
  'home': Home,
  'briefcase': Briefcase,
  'truck': Truck,
  'store': Store,
  'plane': Plane,
  'graduation-cap': GraduationCap,
  'file-text': FileText,
}

interface ServiceIconProps {
  iconType: ServiceIconType | string
  className?: string
  size?: number
}

export function ServiceIcon({ iconType, className = '', size = 24 }: ServiceIconProps) {
  const Icon = iconMap[iconType] || Shield
  return <Icon className={className} size={size} />
}
