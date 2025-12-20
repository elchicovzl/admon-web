export interface ServiceCategoryData {
  id: string
  name: string
  description: string
  iconType: 'clock' | 'chart' | 'star' | 'shield' | 'file' | 'heart'
  services: string[]
  bgColor: string
  textColor: string
  isPopular?: boolean
}

// ============================================
// SERVICE PAGE DATA - Para páginas de detalle
// ============================================

export type ServiceIconType =
  | 'shield' | 'file' | 'heart' | 'star'
  | 'car' | 'stethoscope' | 'umbrella' | 'paw-print' | 'building-2' | 'package'

export interface ServiceTheme {
  primary: string
  bgGradient: string
  iconBg: string
  accentColor: string
  lightBg: string
  borderColor: string
  badgeBg: string
  badgeText: string
}

export interface TargetAudienceItem {
  icon: string
  title: string
  description: string
}

export interface FeatureItem {
  title: string
  description: string
  included: string[]
  image?: string
}

export interface BenefitItem {
  icon: string
  title: string
  description: string
}

export interface ProcessStep {
  step: number
  title: string
  description: string
}

export interface TimelineItem {
  period: string
  responsible: string
  description: string
  color: string
}

export interface ServicePageData {
  // Identificación
  slug: string
  name: string
  shortDescription: string
  fullDescription: string

  // Visual
  theme: ServiceTheme
  iconType: ServiceIconType
  badge?: {
    text: string
    variant: 'popular' | 'new' | 'recommended'
  }

  // Contenido
  targetAudience: TargetAudienceItem[]
  features: FeatureItem[]
  benefits: BenefitItem[]
  process?: ProcessStep[]
  timeline?: TimelineItem[] // Para Recobro de Incapacidades

  // SEO
  seo: {
    title: string
    description: string
    keywords: string[]
  }

  // Relación con categoría padre (para seguros)
  parentCategory?: string
}

// Temas de color por servicio
export const serviceThemes: Record<string, ServiceTheme> = {
  'afiliaciones-seguridad-social': {
    primary: 'blue',
    bgGradient: 'from-blue-50 via-white to-blue-50/30',
    iconBg: 'bg-blue-500',
    accentColor: 'text-blue-600',
    lightBg: 'bg-blue-50/50',
    borderColor: 'border-blue-200',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800'
  },
  'gestion-pila': {
    primary: 'green',
    bgGradient: 'from-green-50 via-white to-green-50/30',
    iconBg: 'bg-green-500',
    accentColor: 'text-green-600',
    lightBg: 'bg-green-50/50',
    borderColor: 'border-green-200',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-800'
  },
  'recobro-incapacidades': {
    primary: 'purple',
    bgGradient: 'from-purple-50 via-white to-purple-50/30',
    iconBg: 'bg-purple-500',
    accentColor: 'text-purple-600',
    lightBg: 'bg-purple-50/50',
    borderColor: 'border-purple-200',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800'
  },
  'seguros': {
    primary: 'amber',
    bgGradient: 'from-amber-50 via-white to-amber-50/30',
    iconBg: 'bg-amber-500',
    accentColor: 'text-amber-600',
    lightBg: 'bg-amber-50/50',
    borderColor: 'border-amber-200',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800'
  }
}

export const serviceCategoriesData: ServiceCategoryData[] = [
  {
    id: 'afiliaciones-seguridad-social',
    name: 'Afiliaciones a Seguridad Social',
    description: 'Para Empresas e Independientes. Su tranquilidad y la de sus colaboradores es nuestro compromiso.',
    iconType: 'shield',
    services: [
      '✓ Gestión integral para Empresas y PYMES',
      '✓ Afiliaciones para Empleadores de Personal Doméstico',
      '✓ Soluciones para Trabajadores Independientes (Contratistas, Profesionales)',
      '✓ Afiliaciones para Colombianos residentes en el exterior',
      '✓ Traslados de EPS Garantizados (devolución si no se logra)',
      '✓ Inclusión de Beneficiarios (Pago de UPC Adicional)'
    ],
    bgColor: 'bg-blue-50',
    textColor: 'text-gray-900',
    isPopular: true
  },
  {
    id: 'gestion-pila',
    name: 'Gestión y Liquidación de Planilla PILA',
    description: 'Ahorre tiempo y evite sanciones. Nosotros nos encargamos de la complejidad.',
    iconType: 'file',
    services: [
      '✓ Liquidación de planillas para Empresas (masivas e individuales)',
      '✓ Liquidación para Contratistas por prestación de servicios',
      '✓ Planillas para Empleados del Servicio Doméstico',
      '✓ Expertos en Liquidación Masiva y Correcciones',
      '✓ Gestión de Moras (M), Órdenes Judiciales (J) y Correcciones (N)',
      '✓ Cumplimiento normativo UGPP garantizado',
      '✓ Pagos 100% seguros y trazables',
      '✓ Reportes en tiempo real'
    ],
    bgColor: 'bg-green-50',
    textColor: 'text-gray-900'
  },
  {
    id: 'recobro-incapacidades',
    name: 'Recobro de Incapacidades y Licencias',
    description: 'Optimizamos el reembolso ante EPS, ARL y Fondos de Pensiones. Su derecho es nuestro compromiso.',
    iconType: 'heart',
    services: [
      '✓ Incapacidades de Origen Común (días 3-180 ante EPS)',
      '✓ Incapacidades de Origen Común prolongadas (días 181-540 ante Fondo de Pensiones)',
      '✓ Accidentes y Enfermedades de Origen Laboral (ARL)',
      '✓ Licencias de Maternidad',
      '✓ Licencias de Paternidad',
      '✓ Gestión completa de documentación',
      '✓ Seguimiento hasta la aprobación',
      '✓ Mejora del flujo de caja empresarial'
    ],
    bgColor: 'bg-purple-50',
    textColor: 'text-gray-900'
  },
  {
    id: 'seguros',
    name: 'Asesoría y Venta de Seguros',
    description: 'Intermediación de seguros con las mejores compañías del mercado.',
    iconType: 'star',
    services: [
      '✓ Seguro de Vehículos (Todo Riesgo, SOAT)',
      '✓ Seguros de Salud (Medicina Prepagada, Emergédica)',
      '✓ Seguros de Vida, Educación y Ahorro',
      '✓ Seguro para Mascotas',
      '✓ Seguros para Empresas (Responsabilidad Civil, Incendio)',
      '✓ Seguros de Hogar',
      '✓ Seguros de Viajes',
      '✓ Accidentes Personales',
      '✓ Títulos de Capitalización'
    ],
    bgColor: 'bg-amber-50',
    textColor: 'text-gray-900'
  }
]

// Detailed service information for individual service pages
export interface DetailedService {
  id: string
  categoryId: string
  title: string
  subtitle: string
  description: string
  targetAudience: string[]
  benefits: string[]
  process?: string[]
  additionalInfo?: string
}

export const detailedServices: DetailedService[] = [
  {
    id: 'afiliaciones-empresas',
    categoryId: 'afiliaciones-seguridad-social',
    title: 'Afiliaciones para Empresas y PYMES',
    subtitle: 'Gestionamos de forma integral las afiliaciones de sus equipos de trabajo',
    description: 'Nos especializamos en facilitar y gestionar todos los trámites relacionados con la Seguridad Social en Colombia, asegurando que siempre estés protegido y al día con tus obligaciones.',
    targetAudience: [
      'Empresas de todos los tamaños',
      'PYMES en crecimiento',
      'Startups que formalizan su primer empleado'
    ],
    benefits: [
      'Cumplimiento normativo garantizado',
      'Ahorro de tiempo administrativo',
      'Reducción total de riesgos y sanciones',
      'Asesoría experta permanente'
    ]
  },
  {
    id: 'traslados-eps',
    categoryId: 'afiliaciones-seguridad-social',
    title: 'Traslados de EPS Garantizados',
    subtitle: '¿No está satisfecho con su EPS actual?',
    description: 'Gestionamos su traslado de forma rápida y segura. Si no logramos el traslado, le devolvemos su dinero.',
    targetAudience: [
      'Personas insatisfechas con su EPS actual',
      'Trabajadores que cambian de ciudad',
      'Familias que buscan mejor cobertura'
    ],
    benefits: [
      'Garantía de devolución si no se logra el traslado',
      'Proceso rápido y sin complicaciones',
      'Asesoría para elegir la mejor EPS',
      'Seguimiento completo del trámite'
    ]
  },
  {
    id: 'pila-empresas',
    categoryId: 'gestion-pila',
    title: 'Liquidación PILA para Empresas',
    subtitle: 'Desde planillas masivas hasta pagos individuales',
    description: 'El cálculo y pago de la Planilla Integrada de Liquidación de Aportes (PILA) puede ser un proceso complejo y propenso a errores. Nuestro servicio garantiza que los aportes se realicen de manera correcta y puntual.',
    targetAudience: [
      'Empresas con nómina mensual',
      'Compañías con múltiples sedes',
      'Organizaciones que buscan tercerizar procesos'
    ],
    benefits: [
      'Cumplimiento normativo UGPP',
      'Pagos 100% seguros y trazables',
      'Proceso eficiente y automatizado',
      'Reportes y visibilidad en tiempo real'
    ],
    process: [
      'Validación de documentación y estado de seguridad social',
      'Liquidación precisa según normativa vigente',
      'Generación de planillas listas para pago',
      'Entrega de soportes contables y legales'
    ]
  },
  {
    id: 'recobro-origen-comun',
    categoryId: 'recobro-incapacidades',
    title: 'Recobro de Incapacidades de Origen Común',
    subtitle: 'Recupere el 100% de los montos pagados',
    description: 'El pago de incapacidades es una obligación del empleador, pero su recobro es un derecho fundamental. Nos encargamos de todo el proceso de principio a fin.',
    targetAudience: [
      'Empresas que han pagado incapacidades',
      'Trabajadores independientes',
      'Empleadores de personal doméstico'
    ],
    benefits: [
      'Maximizamos su reembolso',
      'Ahorro de tiempo y recursos valiosos',
      'Expertos en la complejidad normativa',
      'Mejoramos su flujo de caja'
    ],
    process: [
      'Días 1-2: Pagados por el empleador al 100%',
      'Días 3-180: Recobro gestionado ante la EPS',
      'Días 181-540: Recobro ante Fondo de Pensiones (con concepto de rehabilitación)',
      'Días 541+: Continuidad del pago por EPS bajo condiciones específicas'
    ],
    additionalInfo: 'Conocemos cada detalle del proceso y nos aseguramos de que la documentación esté completa para evitar rechazos y glosas.'
  },
  {
    id: 'recobro-origen-laboral',
    categoryId: 'recobro-incapacidades',
    title: 'Recobro de Incapacidades de Origen Laboral',
    subtitle: 'Gestión ante ARL',
    description: 'Nos encargamos de que la ARL pague el 100% del salario base de cotización desde el día siguiente al accidente o diagnóstico de la enfermedad.',
    targetAudience: [
      'Empresas con trabajadores en riesgo laboral',
      'Contratistas en trabajos de alto riesgo',
      'Empleadores que buscan optimizar recobros'
    ],
    benefits: [
      'Pago completo desde el día 1',
      'Sin demoras burocráticas',
      'Seguimiento especializado',
      'Recuperación total del dinero invertido'
    ]
  }
]

// ============================================
// DATOS COMPLETOS PARA PÁGINAS DE SERVICIOS
// ============================================

export const servicePages: ServicePageData[] = [
  // =====================
  // AFILIACIONES A SEGURIDAD SOCIAL
  // =====================
  {
    slug: 'afiliaciones-seguridad-social',
    name: 'Afiliaciones a Seguridad Social',
    shortDescription: 'Para Empresas e Independientes',
    fullDescription: 'Su tranquilidad y la de sus colaboradores es nuestro compromiso. Nos especializamos en facilitar y gestionar todos los trámites relacionados con la Seguridad Social en Colombia, asegurando que siempre estés protegido y al día con tus obligaciones.',
    theme: serviceThemes['afiliaciones-seguridad-social'],
    iconType: 'shield',
    badge: {
      text: 'Más Solicitado',
      variant: 'popular'
    },
    targetAudience: [
      {
        icon: 'building-2',
        title: 'Empresas y PYMES',
        description: 'Gestionamos de forma integral las afiliaciones de sus equipos de trabajo, permitiéndole enfocarse en el crecimiento de su negocio.'
      },
      {
        icon: 'home',
        title: 'Empleadores de Personal Doméstico',
        description: 'Formalice y proteja a sus empleados del hogar de manera sencilla y cumpliendo con toda la normativa vigente.'
      },
      {
        icon: 'user',
        title: 'Trabajadores Independientes',
        description: 'Soluciones a la medida para contratistas, profesionales por prestación de servicios, comerciantes y rentistas de capital.'
      }
    ],
    features: [
      {
        title: 'Traslados de EPS Garantizados',
        description: '¿No está satisfecho con su EPS actual? Gestionamos su traslado de forma rápida y segura.',
        included: [
          'Gestión completa del proceso de traslado',
          'Asesoría para elegir la mejor EPS',
          'Si no logramos el traslado, le devolvemos su dinero'
        ],
        image: '/images/services/signing.png'
      },
      {
        title: 'Inclusión de Beneficiarios',
        description: 'Afiliamos a los miembros de su familia para que todos cuenten con la cobertura que merecen.',
        included: [
          'Pago de UPC Adicional',
          'Gestión de documentación',
          'Seguimiento hasta la aprobación'
        ]
      },
      {
        title: 'Colombianos en el Exterior',
        description: 'Soluciones para colombianos residentes en el exterior que deseen cotizar en Colombia.',
        included: [
          'Asesoría personalizada',
          'Gestión remota completa',
          'Mantenimiento de derechos en Colombia'
        ]
      }
    ],
    benefits: [
      {
        icon: 'check-circle',
        title: 'Cumplimiento Normativo Garantizado',
        description: 'La tranquilidad de estar siempre al día. Evite dolores de cabeza y posibles sanciones de entidades como la UGPP, Ministerios, EPS, ARL, CCF y Fondos de Pensiones.'
      },
      {
        icon: 'clock',
        title: 'Ahorro de Tiempo y Recursos',
        description: '¡Libérese de cargas administrativas! Deje la burocracia en nuestras manos y dedique su tiempo y energía a lo que realmente importa.'
      },
      {
        icon: 'zap',
        title: 'Gestión Eficiente y sin Errores',
        description: 'Somos expertos en el sistema de Seguridad Social colombiano. Realizamos las afiliaciones y le entregamos las planillas PILA listas para su pago.'
      },
      {
        icon: 'shield',
        title: 'Reducción Total de Riesgos',
        description: 'Una gestión incorrecta puede acarrear multas, intereses por mora y problemas en la prestación de servicios de salud o en su futura pensión.'
      },
      {
        icon: 'headphones',
        title: 'Asesoría Experta y Permanente',
        description: 'No solo gestionamos sus afiliaciones, lo asesoramos para que tome siempre las mejores decisiones sobre su cobertura.'
      }
    ],
    seo: {
      title: 'Afiliaciones a Seguridad Social | Administración Segura',
      description: 'Gestionamos afiliaciones a EPS, ARL, Pensión y Caja de Compensación para empresas, independientes y empleadores de servicio doméstico en Colombia.',
      keywords: ['afiliaciones seguridad social', 'EPS', 'ARL', 'pensión', 'caja de compensación', 'Colombia']
    }
  },

  // =====================
  // GESTIÓN Y LIQUIDACIÓN PILA
  // =====================
  {
    slug: 'gestion-pila',
    name: 'Gestión y Liquidación de Planilla PILA',
    shortDescription: 'Ahorre tiempo y evite sanciones',
    fullDescription: 'El cálculo y pago de la Planilla Integrada de Liquidación de Aportes (PILA) puede ser un proceso complejo y propenso a errores que derivan en sanciones. Nuestro servicio está diseñado para liberarlo de esa carga, garantizando que los aportes a la seguridad social se realicen de manera correcta y puntual.',
    theme: serviceThemes['gestion-pila'],
    iconType: 'file',
    targetAudience: [
      {
        icon: 'building-2',
        title: 'Empresas',
        description: 'Gestionamos desde planillas masivas hasta pagos individuales de sus empleados.'
      },
      {
        icon: 'briefcase',
        title: 'Contratistas',
        description: 'Facilitamos el pago de aportes para sus contratos por prestación de servicios.'
      },
      {
        icon: 'home',
        title: 'Empleados del Servicio Doméstico',
        description: 'Aseguramos la correcta liquidación y pago para el personal de su hogar, cumpliendo con toda la normativa.'
      }
    ],
    features: [
      {
        title: 'Liquidación Masiva y Correcciones',
        description: 'Expertos en gestionar todo tipo de planillas, incluyendo casos especiales.',
        included: [
          'Planillas de Moras (M)',
          'Órdenes Judiciales (J)',
          'Correcciones (N)',
          'Liquidación masiva para grandes empresas'
        ],
        image: '/images/services/support.png'
      },
      {
        title: 'Validación UGPP',
        description: 'Nuestro proceso está diseñado para cumplir rigurosamente con todos los parámetros de la UGPP.',
        included: [
          'Validación de documentación',
          'Verificación del estado de seguridad social',
          'Prevención de requerimientos y multas'
        ],
        image: '/images/services/chart.png'
      }
    ],
    benefits: [
      {
        icon: 'check-circle',
        title: 'Cumplimiento Normativo Garantizado',
        description: 'Validamos la documentación y el estado de la seguridad social para asegurar que cada pago sea correcto y evitarle cualquier tipo de requerimiento o multa.'
      },
      {
        icon: 'lock',
        title: 'Pagos 100% Seguros y Trazables',
        description: 'Le ofrecemos total tranquilidad. Cada transacción es segura y completamente rastreable, generando los soportes contables y legales que su contabilidad necesita.'
      },
      {
        icon: 'zap',
        title: 'Proceso Eficiente y Automatizado',
        description: 'Nos adaptamos a sus reglas de negocio, fechas de corte y condiciones. Nuestro sistema automatizado ejecuta los pagos de forma precisa.'
      },
      {
        icon: 'bar-chart',
        title: 'Reportes en Tiempo Real',
        description: 'Tenga siempre el control. Le proporcionamos acceso a reportes claros y en tiempo real sobre el estado de sus pagos y liquidaciones.'
      }
    ],
    process: [
      {
        step: 1,
        title: 'Validación',
        description: 'Verificamos documentación y estado de seguridad social de cada cotizante.'
      },
      {
        step: 2,
        title: 'Liquidación',
        description: 'Calculamos los aportes según la normativa vigente y sus condiciones específicas.'
      },
      {
        step: 3,
        title: 'Generación',
        description: 'Creamos las planillas PILA listas para su revisión y pago.'
      },
      {
        step: 4,
        title: 'Entrega',
        description: 'Proporcionamos todos los soportes contables y legales necesarios.'
      }
    ],
    seo: {
      title: 'Gestión y Liquidación de Planilla PILA | Administración Segura',
      description: 'Servicio de liquidación de planillas PILA para empresas, contratistas y empleadores de servicio doméstico. Evite sanciones de la UGPP.',
      keywords: ['planilla PILA', 'liquidación PILA', 'UGPP', 'aportes seguridad social', 'Colombia']
    }
  },

  // =====================
  // RECOBRO DE INCAPACIDADES
  // =====================
  {
    slug: 'recobro-incapacidades',
    name: 'Recobro de Incapacidades y Licencias',
    shortDescription: 'Optimizamos el reembolso ante EPS, ARL y Fondos de Pensiones',
    fullDescription: 'El pago de incapacidades y licencias es una obligación del empleador, pero su recobro es un derecho fundamental. Sin embargo, el proceso para obtener el reembolso del dinero pagado a sus colaboradores puede ser un laberinto burocrático. Nuestro servicio se encarga de todo el proceso de principio a fin.',
    theme: serviceThemes['recobro-incapacidades'],
    iconType: 'heart',
    targetAudience: [
      {
        icon: 'building-2',
        title: 'Empresas',
        description: 'Recupere el 100% de los montos pagados por incapacidades y licencias de sus colaboradores.'
      },
      {
        icon: 'user',
        title: 'Trabajadores Independientes',
        description: 'Gestionamos el recobro de sus incapacidades para que recupere su dinero.'
      },
      {
        icon: 'home',
        title: 'Empleadores de Personal Doméstico',
        description: 'Aseguramos que recupere los pagos realizados por incapacidades de su empleado.'
      }
    ],
    features: [
      {
        title: 'Incapacidades de Origen Común',
        description: 'Gestionamos el recobro por enfermedad o accidente no laboral.',
        included: [
          'Gestión ante EPS (días 3-180)',
          'Gestión ante Fondo de Pensiones (días 181-540)',
          'Seguimiento de concepto de rehabilitación',
          'Casos especiales (días 541+)'
        ]
      },
      {
        title: 'Incapacidades de Origen Laboral',
        description: 'Nos encargamos de que la ARL pague el 100% desde el día siguiente al accidente.',
        included: [
          'Gestión ante ARL',
          '100% del salario base de cotización',
          'Sin demoras burocráticas'
        ]
      },
      {
        title: 'Licencias de Maternidad y Paternidad',
        description: 'Gestionamos el recobro completo de licencias parentales.',
        included: [
          'Licencias de maternidad',
          'Licencias de paternidad',
          'Documentación completa'
        ]
      }
    ],
    benefits: [
      {
        icon: 'trending-up',
        title: 'Maximizamos su Reembolso',
        description: 'Conocemos cada detalle del proceso. Nos aseguramos de que la documentación esté completa para evitar rechazos y glosas.'
      },
      {
        icon: 'clock',
        title: 'Ahorro de Tiempo y Recursos',
        description: 'Olvídese de las largas esperas, el papeleo interminable y las llamadas infructuosas a las EPS, ARL y Fondos de Pensiones.'
      },
      {
        icon: 'book-open',
        title: 'Expertos en Complejidad Normativa',
        description: 'Navegamos por usted en el complejo sistema de responsabilidades. Sabemos exactamente a quién, cómo y cuándo solicitar el recobro.'
      },
      {
        icon: 'dollar-sign',
        title: 'Mejoramos su Flujo de Caja',
        description: 'Aceleramos los tiempos de respuesta de las entidades para que el dinero regrese a su cuenta lo antes posible.'
      }
    ],
    timeline: [
      {
        period: 'Días 1-2',
        responsible: 'Empleador',
        description: 'Pagados por el empleador al 100%. No hay recobro.',
        color: 'gray'
      },
      {
        period: 'Días 3-180',
        responsible: 'EPS',
        description: 'El recobro se gestiona ante la EPS. Nos encargamos de toda la documentación.',
        color: 'blue'
      },
      {
        period: 'Días 181-540',
        responsible: 'Fondo de Pensiones',
        description: 'Requiere concepto de rehabilitación favorable de la EPS. Si la EPS falla, vigilamos que continúe pagando.',
        color: 'purple'
      },
      {
        period: 'Días 541+',
        responsible: 'EPS (condiciones especiales)',
        description: 'Gestionamos la continuidad del pago por parte de la EPS bajo las condiciones específicas que exige la ley.',
        color: 'amber'
      }
    ],
    seo: {
      title: 'Recobro de Incapacidades y Licencias | Administración Segura',
      description: 'Gestionamos el recobro de incapacidades y licencias ante EPS, ARL y Fondos de Pensiones. Recupere el 100% de sus pagos.',
      keywords: ['recobro incapacidades', 'licencias maternidad', 'EPS', 'ARL', 'fondo de pensiones', 'Colombia']
    }
  },

  // =====================
  // SEGUROS - VEHÍCULOS
  // =====================
  {
    slug: 'seguros-vehiculos',
    name: 'Seguro de Vehículos',
    shortDescription: 'Protección integral para su vehículo',
    fullDescription: 'Ofrecemos las mejores opciones de seguros de vehículos del mercado colombiano. Desde pólizas todo riesgo hasta SOAT, le asesoramos para encontrar la cobertura perfecta para sus necesidades y presupuesto.',
    theme: serviceThemes['seguros'],
    iconType: 'car',
    parentCategory: 'seguros',
    targetAudience: [
      {
        icon: 'user',
        title: 'Propietarios de Vehículos',
        description: 'Proteja su inversión con coberturas adaptadas a su tipo de vehículo y uso.'
      },
      {
        icon: 'building-2',
        title: 'Flotas Empresariales',
        description: 'Soluciones corporativas para empresas con múltiples vehículos.'
      },
      {
        icon: 'truck',
        title: 'Vehículos de Carga',
        description: 'Coberturas especiales para transporte de mercancías.'
      }
    ],
    features: [
      {
        title: 'Seguro Todo Riesgo',
        description: 'La protección más completa para su vehículo.',
        included: [
          'Daños por accidente',
          'Robo total y parcial',
          'Responsabilidad civil',
          'Asistencia en carretera 24/7'
        ]
      },
      {
        title: 'SOAT',
        description: 'Seguro Obligatorio de Accidentes de Tránsito.',
        included: [
          'Expedición inmediata',
          'Cobertura nacional',
          'Cumplimiento legal garantizado'
        ]
      }
    ],
    benefits: [
      {
        icon: 'shield',
        title: 'Múltiples Aseguradoras',
        description: 'Comparamos opciones de las mejores compañías para ofrecerle la mejor relación precio-cobertura.'
      },
      {
        icon: 'headphones',
        title: 'Asesoría Personalizada',
        description: 'Le ayudamos a elegir la póliza que mejor se adapte a sus necesidades específicas.'
      },
      {
        icon: 'zap',
        title: 'Gestión de Siniestros',
        description: 'Le acompañamos en todo el proceso en caso de accidente o robo.'
      }
    ],
    seo: {
      title: 'Seguro de Vehículos | Administración Segura',
      description: 'Seguros de vehículos todo riesgo y SOAT. Asesoría personalizada para encontrar la mejor cobertura al mejor precio.',
      keywords: ['seguro vehiculo', 'seguro carro', 'SOAT', 'todo riesgo', 'Colombia']
    }
  },

  // =====================
  // SEGUROS - SALUD
  // =====================
  {
    slug: 'seguros-salud',
    name: 'Seguros de Salud',
    shortDescription: 'Medicina prepagada y planes de salud',
    fullDescription: 'Acceda a los mejores servicios médicos con nuestras opciones de medicina prepagada y planes de salud. Le asesoramos para encontrar la cobertura ideal para usted y su familia.',
    theme: serviceThemes['seguros'],
    iconType: 'stethoscope',
    parentCategory: 'seguros',
    targetAudience: [
      {
        icon: 'users',
        title: 'Familias',
        description: 'Planes familiares con coberturas para todos los miembros del hogar.'
      },
      {
        icon: 'user',
        title: 'Personas Individuales',
        description: 'Planes personales adaptados a su edad y necesidades de salud.'
      },
      {
        icon: 'building-2',
        title: 'Empresas',
        description: 'Planes corporativos como beneficio para sus empleados.'
      }
    ],
    features: [
      {
        title: 'Medicina Prepagada',
        description: 'Acceso a clínicas y especialistas de primer nivel.',
        included: [
          'Red de clínicas premium',
          'Especialistas sin referencia',
          'Hospitalización en habitación individual',
          'Medicamentos incluidos'
        ]
      },
      {
        title: 'Planes Emergédica',
        description: 'Atención de urgencias las 24 horas.',
        included: [
          'Ambulancia medicalizada',
          'Atención domiciliaria',
          'Urgencias sin copagos'
        ]
      }
    ],
    benefits: [
      {
        icon: 'heart',
        title: 'Atención de Calidad',
        description: 'Acceso a las mejores clínicas y profesionales de la salud del país.'
      },
      {
        icon: 'clock',
        title: 'Sin Esperas',
        description: 'Agende citas con especialistas de forma rápida y sin largas esperas.'
      },
      {
        icon: 'shield',
        title: 'Tranquilidad Familiar',
        description: 'Proteja la salud de toda su familia con coberturas integrales.'
      }
    ],
    seo: {
      title: 'Seguros de Salud y Medicina Prepagada | Administración Segura',
      description: 'Medicina prepagada y planes de salud. Acceda a los mejores servicios médicos para usted y su familia.',
      keywords: ['medicina prepagada', 'seguro salud', 'plan de salud', 'Colombia']
    }
  },

  // =====================
  // SEGUROS - VIDA, EDUCACIÓN Y AHORRO
  // =====================
  {
    slug: 'seguros-vida',
    name: 'Seguros de Vida, Educación y Ahorro',
    shortDescription: 'Proteja el futuro de su familia',
    fullDescription: 'Asegure el bienestar financiero de sus seres queridos con nuestros seguros de vida. Además, planifique la educación de sus hijos y construya un patrimonio con nuestros productos de ahorro e inversión.',
    theme: serviceThemes['seguros'],
    iconType: 'umbrella',
    parentCategory: 'seguros',
    targetAudience: [
      {
        icon: 'users',
        title: 'Padres de Familia',
        description: 'Proteja a sus hijos y asegure su educación futura.'
      },
      {
        icon: 'user',
        title: 'Profesionales',
        description: 'Construya un patrimonio mientras protege a su familia.'
      },
      {
        icon: 'heart',
        title: 'Parejas',
        description: 'Planifiquen juntos un futuro financiero seguro.'
      }
    ],
    features: [
      {
        title: 'Seguro de Vida',
        description: 'Protección financiera para su familia en caso de fallecimiento.',
        included: [
          'Indemnización por fallecimiento',
          'Cobertura por incapacidad total',
          'Enfermedades graves',
          'Renta mensual para beneficiarios'
        ]
      },
      {
        title: 'Seguro Educativo',
        description: 'Garantice la educación de sus hijos.',
        included: [
          'Ahorro programado',
          'Protección del capital',
          'Cobertura en caso de fallecimiento del titular'
        ]
      },
      {
        title: 'Planes de Ahorro',
        description: 'Construya patrimonio con rendimientos competitivos.',
        included: [
          'Ahorro flexible',
          'Rendimientos garantizados',
          'Beneficios tributarios'
        ]
      }
    ],
    benefits: [
      {
        icon: 'shield',
        title: 'Tranquilidad Familiar',
        description: 'Su familia estará protegida económicamente ante cualquier eventualidad.'
      },
      {
        icon: 'graduation-cap',
        title: 'Educación Asegurada',
        description: 'Garantice que sus hijos puedan acceder a educación de calidad.'
      },
      {
        icon: 'trending-up',
        title: 'Crecimiento Patrimonial',
        description: 'Haga crecer su dinero con opciones de ahorro e inversión seguras.'
      }
    ],
    seo: {
      title: 'Seguros de Vida, Educación y Ahorro | Administración Segura',
      description: 'Seguros de vida, planes educativos y productos de ahorro. Proteja el futuro financiero de su familia.',
      keywords: ['seguro de vida', 'seguro educativo', 'ahorro', 'inversión', 'Colombia']
    }
  },

  // =====================
  // SEGUROS - MASCOTAS
  // =====================
  {
    slug: 'seguros-mascotas',
    name: 'Seguro para Mascotas',
    shortDescription: 'Protección para su mejor amigo',
    fullDescription: 'Su mascota es parte de la familia. Protéjala con nuestros planes de seguro que cubren gastos veterinarios, accidentes y enfermedades. Porque ellos también merecen la mejor atención.',
    theme: serviceThemes['seguros'],
    iconType: 'paw-print',
    parentCategory: 'seguros',
    targetAudience: [
      {
        icon: 'heart',
        title: 'Dueños de Perros',
        description: 'Coberturas adaptadas a las necesidades de su perro, sin importar la raza.'
      },
      {
        icon: 'heart',
        title: 'Dueños de Gatos',
        description: 'Planes especiales para el cuidado de su felino.'
      },
      {
        icon: 'users',
        title: 'Familias con Mascotas',
        description: 'Proteja a todos los miembros peludos de su hogar.'
      }
    ],
    features: [
      {
        title: 'Cobertura Veterinaria',
        description: 'Gastos médicos cubiertos para su mascota.',
        included: [
          'Consultas veterinarias',
          'Cirugías y hospitalizaciones',
          'Medicamentos',
          'Exámenes de laboratorio'
        ]
      },
      {
        title: 'Responsabilidad Civil',
        description: 'Protección ante daños causados por su mascota a terceros.',
        included: [
          'Daños a personas',
          'Daños a propiedades',
          'Defensa legal'
        ]
      }
    ],
    benefits: [
      {
        icon: 'heart',
        title: 'Atención Sin Preocupaciones',
        description: 'Lleve a su mascota al veterinario sin preocuparse por los costos.'
      },
      {
        icon: 'shield',
        title: 'Protección Integral',
        description: 'Cobertura para accidentes, enfermedades y responsabilidad civil.'
      },
      {
        icon: 'zap',
        title: 'Red de Veterinarios',
        description: 'Acceso a una amplia red de clínicas veterinarias afiliadas.'
      }
    ],
    seo: {
      title: 'Seguro para Mascotas | Administración Segura',
      description: 'Seguros para perros y gatos. Cubra gastos veterinarios y proteja a su mascota con las mejores coberturas.',
      keywords: ['seguro mascotas', 'seguro perros', 'seguro gatos', 'veterinario', 'Colombia']
    }
  },

  // =====================
  // SEGUROS - EMPRESAS
  // =====================
  {
    slug: 'seguros-empresas',
    name: 'Seguros para Empresas',
    shortDescription: 'Protección integral para su negocio',
    fullDescription: 'Proteja su empresa con nuestras soluciones de seguros corporativos. Desde responsabilidad civil hasta incendio y robo, ofrecemos coberturas diseñadas para las necesidades específicas de cada negocio.',
    theme: serviceThemes['seguros'],
    iconType: 'building-2',
    parentCategory: 'seguros',
    targetAudience: [
      {
        icon: 'building-2',
        title: 'PYMES',
        description: 'Soluciones accesibles para pequeñas y medianas empresas.'
      },
      {
        icon: 'briefcase',
        title: 'Grandes Empresas',
        description: 'Programas de seguros corporativos a la medida.'
      },
      {
        icon: 'store',
        title: 'Comercios',
        description: 'Protección para locales comerciales y sus inventarios.'
      }
    ],
    features: [
      {
        title: 'Responsabilidad Civil',
        description: 'Protección ante reclamaciones de terceros.',
        included: [
          'Responsabilidad civil extracontractual',
          'Responsabilidad civil profesional',
          'Responsabilidad civil de productos',
          'Defensa jurídica'
        ]
      },
      {
        title: 'Seguro de Incendio y Robo',
        description: 'Proteja sus activos físicos.',
        included: [
          'Edificios e instalaciones',
          'Maquinaria y equipos',
          'Inventarios y mercancías',
          'Lucro cesante'
        ]
      },
      {
        title: 'Seguros de Cumplimiento',
        description: 'Garantías para contratos y licitaciones.',
        included: [
          'Cumplimiento de contratos',
          'Seriedad de oferta',
          'Calidad y estabilidad',
          'Pago de salarios y prestaciones'
        ]
      }
    ],
    benefits: [
      {
        icon: 'shield',
        title: 'Protección Patrimonial',
        description: 'Proteja los activos de su empresa contra imprevistos.'
      },
      {
        icon: 'file-text',
        title: 'Cumplimiento Contractual',
        description: 'Acceda a contratos públicos y privados con las garantías necesarias.'
      },
      {
        icon: 'users',
        title: 'Tranquilidad para Socios',
        description: 'Demuestre a sus stakeholders que su empresa está protegida.'
      }
    ],
    seo: {
      title: 'Seguros para Empresas | Administración Segura',
      description: 'Seguros empresariales: responsabilidad civil, incendio, robo y cumplimiento. Proteja su negocio con las mejores coberturas.',
      keywords: ['seguro empresarial', 'responsabilidad civil', 'seguro incendio', 'póliza cumplimiento', 'Colombia']
    }
  },

  // =====================
  // SEGUROS - OTROS PRODUCTOS
  // =====================
  {
    slug: 'seguros-otros',
    name: 'Otros Productos de Seguros',
    shortDescription: 'Hogar, viajes, accidentes personales y más',
    fullDescription: 'Complementamos nuestra oferta con productos de seguros para cada aspecto de su vida. Desde la protección de su hogar hasta seguros de viaje y accidentes personales, tenemos la solución que necesita.',
    theme: serviceThemes['seguros'],
    iconType: 'package',
    parentCategory: 'seguros',
    targetAudience: [
      {
        icon: 'home',
        title: 'Propietarios de Vivienda',
        description: 'Proteja su hogar y sus pertenencias.'
      },
      {
        icon: 'plane',
        title: 'Viajeros',
        description: 'Viaje tranquilo con cobertura internacional.'
      },
      {
        icon: 'user',
        title: 'Personas Activas',
        description: 'Protección ante accidentes en su vida diaria.'
      }
    ],
    features: [
      {
        title: 'Seguro de Hogar',
        description: 'Protección integral para su vivienda.',
        included: [
          'Incendio y explosión',
          'Robo y hurto',
          'Daños por agua',
          'Responsabilidad civil familiar'
        ]
      },
      {
        title: 'Seguro de Viajes',
        description: 'Viaje con tranquilidad a cualquier destino.',
        included: [
          'Gastos médicos en el exterior',
          'Cancelación de viaje',
          'Pérdida de equipaje',
          'Asistencia 24/7'
        ]
      },
      {
        title: 'Accidentes Personales',
        description: 'Protección ante accidentes en su vida cotidiana.',
        included: [
          'Indemnización por accidente',
          'Gastos médicos',
          'Incapacidad temporal',
          'Auxilio funerario'
        ]
      },
      {
        title: 'Títulos de Capitalización',
        description: 'Ahorre y participe en sorteos.',
        included: [
          'Ahorro programado',
          'Participación en sorteos',
          'Devolución del capital'
        ]
      }
    ],
    benefits: [
      {
        icon: 'home',
        title: 'Hogar Protegido',
        description: 'Tranquilidad sabiendo que su vivienda y pertenencias están aseguradas.'
      },
      {
        icon: 'plane',
        title: 'Viajes Sin Preocupaciones',
        description: 'Disfrute sus viajes con la seguridad de estar cubierto ante cualquier imprevisto.'
      },
      {
        icon: 'heart',
        title: 'Vida Cotidiana Segura',
        description: 'Protección ante accidentes en cualquier momento y lugar.'
      }
    ],
    seo: {
      title: 'Seguros de Hogar, Viajes y Accidentes | Administración Segura',
      description: 'Seguros de hogar, viajes internacionales, accidentes personales y títulos de capitalización. Protección para cada aspecto de su vida.',
      keywords: ['seguro hogar', 'seguro viajes', 'accidentes personales', 'capitalización', 'Colombia']
    }
  }
]

// Helper function para obtener servicio por slug
export function getServiceBySlug(slug: string): ServicePageData | undefined {
  return servicePages.find(service => service.slug === slug)
}

// Helper function para obtener servicios relacionados (excluyendo el actual)
export function getRelatedServices(currentSlug: string, limit: number = 3): ServicePageData[] {
  return servicePages
    .filter(service => service.slug !== currentSlug)
    .slice(0, limit)
}
