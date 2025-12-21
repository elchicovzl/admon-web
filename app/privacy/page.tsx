import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import WhatsAppWidget from '@/components/ui/whatsapp-widget'
import { Metadata } from 'next'
import Link from 'next/link'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://administracionsegura.com'

export const metadata: Metadata = {
  title: 'Política de Privacidad | Administración Segura',
  description: 'Política de privacidad y tratamiento de datos personales de Administración Segura. Conoce cómo protegemos tu información.',
  alternates: {
    canonical: `${BASE_URL}/privacy`,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Política de Privacidad | Administración Segura',
    description: 'Política de privacidad y tratamiento de datos personales de Administración Segura.',
    url: `${BASE_URL}/privacy`,
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
    title: 'Política de Privacidad | Administración Segura',
    description: 'Política de privacidad y tratamiento de datos personales.',
  },
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
            Política de Privacidad
          </h1>

          <p className="text-gray-600 mb-8">
            Última actualización: 20 de diciembre de 2025
          </p>

          <div className="prose prose-gray max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                1. Información General
              </h2>
              <p className="text-gray-700 mb-4">
                <strong>ADMINISTRACIÓN SEGURA</strong>, con domicilio en Cra 43 # 33 - 57 local 156,
                Plazuelas de San Diego, Medellín, Colombia, es responsable del tratamiento de los datos
                personales que usted nos proporciona, los cuales serán protegidos conforme a la Ley 1581
                de 2012 (Ley de Protección de Datos Personales) y demás normativa aplicable en Colombia.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                2. Datos Personales que Recopilamos
              </h2>
              <p className="text-gray-700 mb-4">
                Para la prestación de nuestros servicios de afiliación a seguridad social, gestión de
                planilla PILA, recobro de incapacidades y asesoría en seguros, podemos recopilar los
                siguientes datos:
              </p>
              <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
                <li><strong>Datos de identificación:</strong> Nombre completo, número de cédula, fecha de nacimiento, lugar de expedición del documento.</li>
                <li><strong>Datos de contacto:</strong> Dirección, teléfono, correo electrónico.</li>
                <li><strong>Datos laborales:</strong> Información del empleador, tipo de contrato, salario, fechas de ingreso y retiro.</li>
                <li><strong>Datos de seguridad social:</strong> EPS, fondo de pensiones, ARL, caja de compensación actual.</li>
                <li><strong>Datos financieros:</strong> Información bancaria para pagos y reembolsos.</li>
                <li><strong>Datos de beneficiarios:</strong> Información de familiares para inclusión en el sistema de seguridad social.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                3. Finalidad del Tratamiento de Datos
              </h2>
              <p className="text-gray-700 mb-4">
                Sus datos personales serán utilizados para las siguientes finalidades:
              </p>
              <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
                <li>Gestionar afiliaciones y traslados ante EPS, fondos de pensiones, ARL y cajas de compensación.</li>
                <li>Realizar la liquidación y pago de planillas PILA.</li>
                <li>Tramitar el recobro de incapacidades y licencias ante las entidades correspondientes.</li>
                <li>Asesorar y gestionar la contratación de seguros.</li>
                <li>Comunicarnos con usted para informar sobre el estado de sus trámites.</li>
                <li>Cumplir con obligaciones legales y requerimientos de autoridades competentes.</li>
                <li>Enviar información sobre nuestros servicios (solo con su autorización previa).</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                4. Compartir Información con Terceros
              </h2>
              <p className="text-gray-700 mb-4">
                Para la correcta prestación de nuestros servicios, sus datos podrán ser compartidos con:
              </p>
              <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
                <li><strong>Entidades de seguridad social:</strong> EPS, fondos de pensiones, ARL, cajas de compensación familiar.</li>
                <li><strong>Entidades gubernamentales:</strong> UGPP, Ministerio de Salud, Ministerio del Trabajo cuando sea requerido.</li>
                <li><strong>Compañías de seguros:</strong> Para la gestión de pólizas y reclamaciones.</li>
                <li><strong>Entidades financieras:</strong> Para el procesamiento de pagos.</li>
              </ul>
              <p className="text-gray-700 mb-4">
                No vendemos, alquilamos ni compartimos su información personal con terceros para fines
                de marketing sin su consentimiento expreso.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                5. Derechos del Titular de los Datos
              </h2>
              <p className="text-gray-700 mb-4">
                De acuerdo con la Ley 1581 de 2012, usted tiene derecho a:
              </p>
              <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
                <li><strong>Conocer:</strong> Acceder a sus datos personales que hayamos recopilado.</li>
                <li><strong>Actualizar:</strong> Solicitar la corrección de datos inexactos o incompletos.</li>
                <li><strong>Rectificar:</strong> Modificar información que sea errónea.</li>
                <li><strong>Suprimir:</strong> Solicitar la eliminación de sus datos cuando no exista obligación legal de conservarlos.</li>
                <li><strong>Revocar:</strong> Retirar la autorización otorgada para el tratamiento de sus datos.</li>
                <li><strong>Presentar quejas:</strong> Ante la Superintendencia de Industria y Comercio (SIC).</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                6. Seguridad de la Información
              </h2>
              <p className="text-gray-700 mb-4">
                Implementamos medidas de seguridad técnicas, administrativas y físicas para proteger
                sus datos personales contra acceso no autorizado, pérdida, alteración o destrucción.
                Estas medidas incluyen:
              </p>
              <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
                <li>Cifrado de datos sensibles.</li>
                <li>Acceso restringido a la información solo a personal autorizado.</li>
                <li>Protocolos de seguridad en nuestros sistemas informáticos.</li>
                <li>Capacitación continua a nuestro equipo sobre protección de datos.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                7. Cookies y Tecnologías Similares
              </h2>
              <p className="text-gray-700 mb-4">
                Nuestro sitio web puede utilizar cookies y tecnologías similares para mejorar su
                experiencia de navegación. Estas tecnologías nos permiten:
              </p>
              <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
                <li>Recordar sus preferencias de navegación.</li>
                <li>Analizar el uso del sitio web para mejorarlo.</li>
                <li>Proporcionar contenido personalizado.</li>
              </ul>
              <p className="text-gray-700 mb-4">
                Puede configurar su navegador para rechazar cookies, aunque esto podría afectar
                algunas funcionalidades del sitio.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                8. Conservación de Datos
              </h2>
              <p className="text-gray-700 mb-4">
                Conservaremos sus datos personales durante el tiempo necesario para cumplir con las
                finalidades para las que fueron recopilados y para cumplir con obligaciones legales.
                Los documentos relacionados con seguridad social se conservan según los plazos
                establecidos por la normativa colombiana.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                9. Cambios a esta Política
              </h2>
              <p className="text-gray-700 mb-4">
                Nos reservamos el derecho de modificar esta Política de Privacidad en cualquier
                momento. Los cambios serán publicados en esta página con la fecha de actualización.
                Le recomendamos revisar periódicamente esta política.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                10. Contacto
              </h2>
              <p className="text-gray-700 mb-4">
                Para ejercer sus derechos o resolver cualquier duda sobre el tratamiento de sus
                datos personales, puede contactarnos a través de:
              </p>
              <ul className="list-none text-gray-700 mb-4 space-y-2">
                <li><strong>Correo electrónico:</strong> <Link href="mailto:contacto@administracionsegura.com" className="text-[#00A86B] hover:underline">contacto@administracionsegura.com</Link></li>
                <li><strong>Teléfono:</strong> <Link href="tel:+573197941064" className="text-[#00A86B] hover:underline">+57 (319) 794-1064</Link></li>
                <li><strong>Dirección:</strong> Cra 43 # 33 - 57 local 156, Plazuelas de San Diego, Medellín, Colombia</li>
              </ul>
            </section>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppWidget />
    </div>
  )
}
