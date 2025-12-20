import { FAQItem } from '@/lib/types'

export const faqs: FAQItem[] = [
  {
    id: 'que-es-seguridad-social',
    question: '¿Qué es la seguridad social en Colombia?',
    answer: 'La seguridad social es un sistema integral que protege a los trabajadores y sus familias. Incluye salud (EPS), pensión, riesgos laborales (ARL) y caja de compensación familiar. Es obligatoria para todos los trabajadores dependientes e independientes con ingresos iguales o superiores a un salario mínimo.',
    category: 'general'
  },
  {
    id: 'quienes-deben-afiliarse',
    question: '¿Quiénes deben afiliarse a la seguridad social?',
    answer: 'Deben afiliarse todos los trabajadores dependientes (empleados con contrato laboral), trabajadores independientes con ingresos de un salario mínimo o más, contratistas, y pensionados. Las empresas tienen la obligación de afiliar a sus empleados desde el primer día de trabajo.',
    category: 'general'
  },
  {
    id: 'tiempo-afiliacion',
    question: '¿Cuánto tiempo toma realizar una afiliación?',
    answer: 'El proceso de afiliación generalmente toma entre 1 a 3 días hábiles dependiendo de la entidad. Con nuestro servicio, nos encargamos de toda la gestión para que el proceso sea rápido y sin complicaciones. Usted solo debe proporcionar los documentos requeridos.',
    category: 'proceso'
  },
  {
    id: 'documentos-necesarios',
    question: '¿Qué documentos necesito para afiliarme?',
    answer: 'Los documentos básicos son: cédula de ciudadanía, formulario de afiliación diligenciado, y certificado de ingresos o contrato laboral. Para beneficiarios adicionales se requiere documento de identidad y registro civil que acredite el parentesco. Nosotros le guiamos en todo el proceso.',
    category: 'proceso'
  },
  {
    id: 'que-es-pila',
    question: '¿Qué es la planilla PILA y para qué sirve?',
    answer: 'La Planilla Integrada de Liquidación de Aportes (PILA) es el mecanismo unificado para pagar los aportes a seguridad social (salud, pensión, ARL) y parafiscales. Permite a empleadores e independientes cumplir con sus obligaciones en un solo pago mensual.',
    category: 'servicios'
  },
  {
    id: 'recobro-incapacidades',
    question: '¿Cómo funciona el recobro de incapacidades?',
    answer: 'Cuando un trabajador presenta incapacidad médica, la empresa paga inicialmente el salario. Nosotros gestionamos el recobro ante la EPS o ARL según corresponda, recuperando el dinero que legalmente debe asumir la entidad. Este proceso puede tomar entre 30 a 90 días dependiendo de la entidad.',
    category: 'servicios'
  },
  {
    id: 'diferencia-eps-contributiva-subsidiada',
    question: '¿Cuál es la diferencia entre EPS contributiva y subsidiada?',
    answer: 'La EPS contributiva es para personas con capacidad de pago (empleados, independientes, pensionados) que aportan mensualmente. La EPS subsidiada es para personas sin capacidad de pago, clasificadas en niveles 1 y 2 del SISBEN, cuya afiliación es financiada por el Estado.',
    category: 'general'
  },
  {
    id: 'empresas-independientes',
    question: '¿Atienden tanto a empresas como a independientes?',
    answer: 'Sí, brindamos servicios tanto a empresas de todos los tamaños como a trabajadores independientes. Para empresas ofrecemos gestión completa de nómina y seguridad social. Para independientes, asesoría personalizada en afiliaciones y liquidación de aportes.',
    category: 'clientes'
  },
  {
    id: 'costos-servicios',
    question: '¿Cuáles son los costos de sus servicios?',
    answer: 'Ofrecemos asesorías gratuitas para evaluar su situación. Los costos de nuestros servicios varían según el tipo de gestión requerida. Contáctenos para una cotización personalizada sin compromiso. Nuestro objetivo es ahorrarle tiempo y evitar sanciones costosas.',
    category: 'servicios'
  },
  {
    id: 'sanciones-no-afiliacion',
    question: '¿Qué sanciones existen por no afiliar a los trabajadores?',
    answer: 'Las empresas que no afilian a sus trabajadores pueden enfrentar multas de hasta 500 salarios mínimos, además de responder directamente por accidentes laborales y enfermedades. También pueden ser sancionadas por evasión de aportes. Nosotros le ayudamos a estar siempre al día.',
    category: 'general'
  }
]

export const faqCategories = [
  { id: 'general', name: 'General', icon: '❓' },
  { id: 'proceso', name: 'Proceso', icon: '⚙️' },
  { id: 'servicios', name: 'Servicios', icon: '🛠️' },
  { id: 'clientes', name: 'Clientes', icon: '👥' }
]
