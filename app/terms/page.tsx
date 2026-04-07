import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import WhatsAppWidget from '@/components/ui/whatsapp-widget'
import { Metadata } from 'next'
import Link from 'next/link'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://administracionsegura.co'

export const metadata: Metadata = {
  title: 'Términos de Servicio | Administración Segura',
  description: 'Términos y condiciones de uso de los servicios de Administración Segura. Conoce tus derechos y obligaciones.',
  alternates: {
    canonical: `${BASE_URL}/terms`,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Términos de Servicio | Administración Segura',
    description: 'Términos y condiciones de uso de los servicios de Administración Segura.',
    url: `${BASE_URL}/terms`,
    siteName: 'Administración Segura',
    locale: 'es_CO',
    type: 'website',
    images: [
      {
        url: `${BASE_URL}/images/logoadmon2.webp`,
        width: 512,
        height: 512,
        alt: 'Administración Segura Logo',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Términos de Servicio | Administración Segura',
    description: 'Términos y condiciones de los servicios.',
  },
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
            Términos de Servicio
          </h1>

          <p className="text-gray-600 mb-8">
            Última actualización: 20 de diciembre de 2025
          </p>

          <div className="prose prose-gray max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                1. Aceptación de los Términos
              </h2>
              <p className="text-gray-700 mb-4">
                Al acceder y utilizar los servicios de <strong>ADMINISTRACIÓN SEGURA</strong>, usted
                acepta estos Términos de Servicio en su totalidad. Si no está de acuerdo con alguno
                de estos términos, le solicitamos no utilizar nuestros servicios.
              </p>
              <p className="text-gray-700 mb-4">
                Estos términos constituyen un acuerdo legal vinculante entre usted y Administración
                Segura, con domicilio en Cra 43 # 33 - 57 local 156, Plazuelas de San Diego, Medellín,
                Colombia.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                2. Descripción de los Servicios
              </h2>
              <p className="text-gray-700 mb-4">
                Administración Segura ofrece los siguientes servicios:
              </p>
              <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
                <li><strong>Afiliaciones a Seguridad Social:</strong> Gestión de afiliaciones y traslados ante EPS, fondos de pensiones, ARL y cajas de compensación familiar.</li>
                <li><strong>Gestión de Planilla PILA:</strong> Liquidación, corrección y pago de planillas de seguridad social.</li>
                <li><strong>Recobro de Incapacidades:</strong> Tramitación de incapacidades y licencias ante las entidades correspondientes.</li>
                <li><strong>Asesoría en Seguros:</strong> Cotización, venta y gestión de pólizas de seguros diversos.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                3. Obligaciones del Usuario
              </h2>
              <p className="text-gray-700 mb-4">
                Al utilizar nuestros servicios, usted se compromete a:
              </p>
              <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
                <li>Proporcionar información veraz, completa y actualizada.</li>
                <li>Entregar oportunamente los documentos requeridos para cada trámite.</li>
                <li>Mantener la confidencialidad de sus credenciales de acceso al sistema.</li>
                <li>Notificar inmediatamente cualquier cambio en su información personal o laboral.</li>
                <li>Realizar los pagos acordados en los plazos establecidos.</li>
                <li>No utilizar nuestros servicios para fines ilegales o no autorizados.</li>
                <li>Cumplir con la normativa colombiana de seguridad social aplicable.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                4. Obligaciones de Administración Segura
              </h2>
              <p className="text-gray-700 mb-4">
                Nos comprometemos a:
              </p>
              <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
                <li>Prestar los servicios con diligencia y profesionalismo.</li>
                <li>Mantener la confidencialidad de su información personal.</li>
                <li>Informar oportunamente sobre el estado de sus trámites.</li>
                <li>Cumplir con la normativa vigente en materia de seguridad social y protección de datos.</li>
                <li>Responder a sus consultas y solicitudes en un plazo razonable.</li>
                <li>Gestionar sus trámites ante las entidades correspondientes de manera oportuna.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                5. Tarifas y Pagos
              </h2>
              <p className="text-gray-700 mb-4">
                Las tarifas por nuestros servicios serán informadas previamente a la contratación.
                El pago de los servicios debe realizarse según las condiciones acordadas. Los pagos
                de planillas de seguridad social deben efectuarse con la anticipación necesaria para
                garantizar su procesamiento oportuno.
              </p>
              <p className="text-gray-700 mb-4">
                Los valores de aportes a seguridad social corresponden a las tarifas establecidas
                por las entidades del sistema y la normativa vigente, sobre los cuales no tenemos
                control.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                6. Limitación de Responsabilidad
              </h2>
              <p className="text-gray-700 mb-4">
                Administración Segura no será responsable por:
              </p>
              <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
                <li>Demoras o rechazos por parte de las entidades de seguridad social o aseguradoras que escapen a nuestro control.</li>
                <li>Información incorrecta o incompleta proporcionada por el usuario.</li>
                <li>Cambios en la normativa que afecten los trámites en curso.</li>
                <li>Fallas en los sistemas de las entidades externas (EPS, fondos de pensiones, etc.).</li>
                <li>Pérdidas o daños indirectos derivados del uso de nuestros servicios.</li>
              </ul>
              <p className="text-gray-700 mb-4">
                Nuestra responsabilidad máxima estará limitada al valor de los honorarios pagados
                por el servicio específico que origine el reclamo.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                7. Garantías Específicas
              </h2>
              <p className="text-gray-700 mb-4">
                Para el servicio de <strong>Traslado de EPS</strong>, ofrecemos una garantía de
                devolución del valor del servicio si el traslado no se logra por causas atribuibles
                a nuestra gestión. Esta garantía no aplica cuando el traslado no procede por
                incumplimiento de requisitos del afiliado o restricciones normativas.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                8. Propiedad Intelectual
              </h2>
              <p className="text-gray-700 mb-4">
                Todos los contenidos del sitio web de Administración Segura, incluyendo textos,
                gráficos, logotipos, iconos, imágenes y software, son propiedad de Administración
                Segura o de sus licenciantes y están protegidos por las leyes de propiedad
                intelectual colombianas e internacionales.
              </p>
              <p className="text-gray-700 mb-4">
                Queda prohibida la reproducción, distribución o modificación de estos contenidos
                sin autorización previa por escrito.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                9. Terminación del Servicio
              </h2>
              <p className="text-gray-700 mb-4">
                Cualquiera de las partes puede terminar la relación contractual con previo aviso.
                En caso de terminación:
              </p>
              <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
                <li>Se completarán los trámites en curso hasta donde sea posible.</li>
                <li>Se entregarán los documentos en nuestro poder.</li>
                <li>Se liquidarán los valores pendientes de pago.</li>
              </ul>
              <p className="text-gray-700 mb-4">
                Nos reservamos el derecho de suspender o terminar los servicios en caso de
                incumplimiento de estos términos o conductas fraudulentas.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                10. Modificaciones a los Términos
              </h2>
              <p className="text-gray-700 mb-4">
                Nos reservamos el derecho de modificar estos Términos de Servicio en cualquier
                momento. Los cambios entrarán en vigencia desde su publicación en el sitio web.
                El uso continuado de nuestros servicios después de la publicación de cambios
                constituye su aceptación de los mismos.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                11. Legislación Aplicable y Jurisdicción
              </h2>
              <p className="text-gray-700 mb-4">
                Estos Términos de Servicio se rigen por las leyes de la República de Colombia.
                Cualquier controversia derivada de estos términos o de la prestación de nuestros
                servicios será sometida a la jurisdicción de los tribunales competentes de la
                ciudad de Medellín, Colombia.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                12. Resolución de Conflictos
              </h2>
              <p className="text-gray-700 mb-4">
                Antes de acudir a instancias judiciales, las partes se comprometen a intentar
                resolver cualquier conflicto de manera amistosa. Para presentar una reclamación,
                puede contactarnos a través de los canales indicados a continuación.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                13. Contacto
              </h2>
              <p className="text-gray-700 mb-4">
                Para cualquier consulta sobre estos Términos de Servicio, puede contactarnos:
              </p>
              <ul className="list-none text-gray-700 mb-4 space-y-2">
                <li><strong>Correo electrónico:</strong> <Link href="mailto:contacto@administracionsegura.co" className="text-[#00A86B] hover:underline">contacto@administracionsegura.co</Link></li>
                <li><strong>Teléfono:</strong> <Link href="tel:+573197941064" className="text-[#00A86B] hover:underline">+57 (319) 794-1064</Link></li>
                <li><strong>Dirección:</strong> Cra 43 # 33 - 57 local 156, Plazuelas de San Diego, Medellín, Colombia</li>
              </ul>
            </section>

            <section className="mb-8 p-6 bg-gray-50 rounded-lg">
              <p className="text-gray-700 text-sm">
                Al utilizar los servicios de Administración Segura, usted declara haber leído,
                entendido y aceptado estos Términos de Servicio, así como nuestra{' '}
                <Link href="/privacy" className="text-[#00A86B] hover:underline">
                  Política de Privacidad
                </Link>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppWidget />
    </div>
  )
}
