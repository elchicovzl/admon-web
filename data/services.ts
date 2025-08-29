export interface ServiceCategoryData {
  id: string
  name: string
  description: string
  iconType: 'clock' | 'chart' | 'star'
  services: string[]
  bgColor: string
  textColor: string
  isPopular?: boolean
}

export const serviceCategoriesData: ServiceCategoryData[] = [
  {
    id: 'seguridad-social',
    name: 'Seguridad Social Integral',
    description: 'Servicios especializados en gestión y trámites de seguridad social para empresas e independientes.',
    iconType: 'clock',
    services: [
      'Mensajería especializada en seguridad social (EPS, PENSIÓN, ARL Y CCF)',
      'Transados de EPS',
      'Conciliaciones de estados de cartera con (EPS, PENSIÓN, ARL Y CCF)',
      'Liquidaciones de planillas PILA'
    ],
    bgColor: 'bg-blue-50',
    textColor: 'text-gray-900'
  },
  {
    id: 'gestion-empresarial',
    name: 'Gestión Empresarial',
    description: 'Asesorías y servicios integrales para el crecimiento y cumplimiento empresarial.',
    iconType: 'chart',
    services: [
      'Asesorías empresariales en seguridad social',
      'Pagos electrónicos',
      'Implementación del Sistema de Seguridad y Salud en el Trabajo',
      'Liquidaciones de Nomina'
    ],
    bgColor: 'bg-green-50',
    textColor: 'text-gray-900',
    isPopular: true
  },
  {
    id: 'servicios-especializados',
    name: 'Servicios Especializados',
    description: 'Trámites especializados, asesorías UGPP y productos de seguros para tu tranquilidad.',
    iconType: 'star',
    services: [
      'Tramite de cobro de incapacidades',
      'Asesorías UGPP',
      'Seguros: Autos, SOAT, vida, medicina prepagada, Emermédica, títulos de capitalización'
    ],
    bgColor: 'bg-purple-50',
    textColor: 'text-gray-900'
  }
]