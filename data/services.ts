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
