"use client"

import type React from "react"
import { useState, useTransition, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { MapPin, Mail, Phone, Clock, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { submitContactForm } from "@/lib/actions/contact.actions"

// Business hours configuration
const BUSINESS_HOURS = {
  open: 8, // 8:00 AM
  close: 17, // 5:00 PM (17:00)
  timezone: 'America/Bogota',
}

function getBusinessStatus(): { isOpen: boolean; message: string } {
  const now = new Date()

  // Get current time in Colombia timezone
  const colombiaTime = new Date(now.toLocaleString('en-US', { timeZone: BUSINESS_HOURS.timezone }))
  const day = colombiaTime.getDay() // 0 = Sunday, 6 = Saturday
  const hour = colombiaTime.getHours()

  // Check if weekend
  if (day === 0 || day === 6) {
    return { isOpen: false, message: 'Cerrado - Fin de semana' }
  }

  // Check business hours (Monday to Friday)
  if (hour >= BUSINESS_HOURS.open && hour < BUSINESS_HOURS.close) {
    return { isOpen: true, message: 'Cierra a las 5:00 PM' }
  }

  // Before opening
  if (hour < BUSINESS_HOURS.open) {
    return { isOpen: false, message: 'Abre a las 8:00 AM' }
  }

  // After closing
  return { isOpen: false, message: 'Abre mañana a las 8:00 AM' }
}

export default function ContactSection() {
  const [isPending, startTransition] = useTransition()
  const [businessStatus, setBusinessStatus] = useState({ isOpen: false, message: '' })
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  })
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    subject: "",
    phone: "",
    message: "",
    acceptTerms: false,
    website: "", // Honeypot field - should remain empty
  })

  // Update business status on mount and every minute
  useEffect(() => {
    setBusinessStatus(getBusinessStatus())

    const interval = setInterval(() => {
      setBusinessStatus(getBusinessStatus())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear status when user starts typing
    if (status.type !== 'idle') {
      setStatus({ type: 'idle', message: '' })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    startTransition(async () => {
      const result = await submitContactForm(formData)

      if (result.success) {
        setStatus({ type: 'success', message: result.message || '¡Mensaje enviado!' })
        // Reset form on success
        setFormData({
          fullName: "",
          email: "",
          subject: "",
          phone: "",
          message: "",
          acceptTerms: false,
          website: "",
        })
      } else {
        setStatus({ type: 'error', message: result.error || 'Error al enviar' })
      }
    })
  }

  return (
    <section className="bg-slate-900 text-white py-16 px-4" id="contacto">
      <div className="max-w-6xl mx-auto">
        {/* Interactive Map - Full Width */}
        <div className="mb-16">
          <div className="bg-slate-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="relative h-80 w-full">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3966.061!2d-75.56924158850391!3d6.234085693983!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNsKwMTQnMDIuNyJOIDc1wrAzNCcwOS4zIlc!5e0!3m2!1ses!2sco!4v1609459200000!5m2!1ses!2sco"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0"
              />
            </div>

            <div className="p-6 bg-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-lg">Administración Segura</h4>
                  <p className="text-slate-400 text-sm">Cra 43 # 33 - 57 local 156 plazuelas de san diego</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700 bg-transparent"
                  onClick={() =>
                    window.open("https://maps.google.com/?q=6.234085693983,-75.56924158850391", "_blank")
                  }
                >
                  Ver en Google Maps
                </Button>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="flex items-center space-x-4 text-sm text-slate-400">
                  <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${businessStatus.isOpen ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span>{businessStatus.isOpen ? 'Abierto ahora' : 'Cerrado'}</span>
                  </div>
                  <div>•</div>
                  <div>{businessStatus.message}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Info and Form - Two Columns */}
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Info - Left Column */}
          <div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-8 text-balance">Encuéntranos</h2>

            <div className="space-y-8">
              <div className="flex items-start space-x-4">
                <div className="bg-blue-600 p-3 rounded-lg">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Nuestra Ubicación</h3>
                  <p className="text-slate-300 leading-relaxed">
                    Cra 43 # 33 - 57 local 156 plazuelas de san diego
                    <br />
                    Medellín, Colombia
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-blue-600 p-3 rounded-lg">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Correo Electrónico</h3>
                  <a
                    href="mailto:admon.segura.med@gmail.com"
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    admon.segura.med@gmail.com
                  </a>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-blue-600 p-3 rounded-lg">
                  <Phone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Número de Teléfono</h3>
                  <a href="tel:+573197941064" className="text-blue-400 hover:text-blue-300 transition-colors">
                    +57 (319) 794-1064
                  </a>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-blue-600 p-3 rounded-lg">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Horarios de Atención</h3>
                  <div className="text-slate-300 space-y-1">
                    <p>Lunes a Viernes: 8:00 AM - 5:00 PM</p>
                    <p>Sábado y Domingo: Cerrado</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white bg-transparent"
                onClick={() => window.open("https://wa.me/573197941064", "_blank")}
              >
                WhatsApp
              </Button>
              <Button
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white bg-transparent"
                onClick={() => window.open("tel:+573197941064")}
              >
                Llamar Ahora
              </Button>
            </div>
          </div>

          {/* Contact Form - Right Column */}
          <div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-8 text-balance">Envíanos un mensaje</h2>

            {/* Status Messages */}
            {status.type === 'success' && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <p className="text-green-400">{status.message}</p>
              </div>
            )}

            {status.type === 'error' && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-red-400">{status.message}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Honeypot field - hidden from users, bots will fill it */}
              <div className="absolute -left-[9999px]" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input
                  type="text"
                  id="website"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Input
                    name="fullName"
                    placeholder="Nombre completo *"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    disabled={isPending}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 disabled:opacity-50"
                  />
                </div>
                <div>
                  <Input
                    name="email"
                    type="email"
                    placeholder="Correo electrónico *"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={isPending}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Input
                    name="subject"
                    placeholder="Asunto *"
                    value={formData.subject}
                    onChange={handleInputChange}
                    disabled={isPending}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 disabled:opacity-50"
                  />
                </div>
                <div>
                  <Input
                    name="phone"
                    placeholder="Número de teléfono *"
                    value={formData.phone}
                    onChange={handleInputChange}
                    disabled={isPending}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <Textarea
                  name="message"
                  placeholder="Mensaje *"
                  value={formData.message}
                  onChange={handleInputChange}
                  disabled={isPending}
                  rows={4}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 resize-none disabled:opacity-50"
                />
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="terms"
                  checked={formData.acceptTerms}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, acceptTerms: checked as boolean }))}
                  disabled={isPending}
                  className="border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
                <label htmlFor="terms" className="text-sm text-slate-300 leading-relaxed">
                  Al marcar esta casilla, aceptas el uso de nuestros términos del "Formulario" y consientes el uso de
                  cookies en el navegador.
                </label>
              </div>

              <div>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 w-full disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar Mensaje →'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
