import { Feature } from '@/lib/types'

export const features: Feature[] = [
  {
    id: 'afiliaciones-seguridad-social',
    title: 'Afiliaciones a la Seguridad Social Integral',
    description: 'Gestionamos todas tus afiliaciones de manera rápida y eficiente. Para trabajadores independientes, empresas y servicio doméstico. Incluye EPS (Salud), ARL (Riesgos Laborales), Fondos de Pensiones y Caja de Compensación Familiar.',
    icon: 'search',
    image: '/images/services-1.png',
    stats: {
      value: '100%',
      label: 'Cobertura Integral'
    }
  },
  {
    id: 'liquidaciones-pila',
    title: 'Liquidaciones PILA con Diferentes Operadores',
    description: 'Liquidación y pago completo de la Seguridad Social y Cesantías. Manejamos todas las planillas: E (Empleados), I (Independientes), S (Servicio Doméstico), M (Morao) y N (Correcciones). Proceso automatizado y sin errores.',
    icon: 'trending-up',
    image: '/images/services-2.png',
    stats: {
      value: '5 Tipos',
      label: 'Planillas PILA'
    }
  },
  {
    id: 'recobro-incapacidades',
    title: 'Servicio de Recobro de Incapacidades y Licencias',
    description: 'Te ayudamos a recuperar pagos por incapacidades y licencias de maternidad/paternidad. Gestionamos solicitudes ante EPS, ARL y Fondos de Pensiones tanto para empleadores como trabajadores independientes.',
    icon: 'dollar-sign',
    image: '/images/services-3.png',
    stats: {
      value: '95%',
      label: 'Éxito en Recobros'
    }
  }
]

export const processSteps = [
  {
    id: 'step-1',
    step: 1,
    title: 'Inicia tu optimización',
    description: 'Solicita tu auditoría CRO y completa un formulario de incorporación breve. Esto nos ayuda a entender tu marca, objetivos y audiencia objetivo, asegurando un enfoque personalizado para tu auditoría.',
    color: '#FFD700',
    backgroundColor: '#FFD700'
  },
  {
    id: 'step-2',
    step: 2,
    title: 'Descubre oportunidades ocultas',
    description: 'Nuestro equipo creará tu auditoría analizando el journey del usuario de tu sitio web para identificar puntos problemáticos y revelar estrategias para impulsar las conversiones.',
    color: '#1E40AF',
    backgroundColor: '#E0F2F7'
  },
  {
    id: 'step-3',
    step: 3,
    title: 'Recibe tu auditoría CRO accionable',
    description: 'En dos semanas, recibirás una auditoría personalizada llena de insights y recomendaciones para optimizar tu sitio web.',
    color: '#7C3AED',
    backgroundColor: '#E6E0FF'
  }
]

export const trustedBrands = [
  'GREYSLANDER',
  'B/A',
  'CHEEKY BONSAI',
  'sundae',
  'MORREALE',
  'Just Eno'
]