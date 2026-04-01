import Header from '@/components/layout/header'
import Footer from '@/components/layout/footer'
import WhatsAppWidget from '@/components/ui/whatsapp-widget'

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-screen">{children}</main>
      <Footer />
      <WhatsAppWidget phoneNumber="+573197941064" />
    </>
  )
}
