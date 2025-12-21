import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import WhatsAppWidget from '@/components/ui/whatsapp-widget'

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@300;400;500;600;700&family=Figtree:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-LV4KBTTERD"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-LV4KBTTERD');
          `}
        </Script>
        {children}
        <WhatsAppWidget
          phoneNumber="573197941064"
          message="Hola, me gustaría obtener información sobre sus servicios de seguridad social. Vengo desde su página web."
          companyName="Administración Segura"
        />
      </body>
    </html>
  )
}
