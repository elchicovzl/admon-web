"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

export default function ContactSection() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    subject: '',
    phone: '',
    message: '',
    agreeToTerms: false
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      agreeToTerms: e.target.checked
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission here
    console.log('Form submitted:', formData)
  }

  return (
    <section className="py-20 bg-gray-900 text-white" id="contacto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Left side - Contact Form */}
          <div>
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-8">
              Envíanos un mensaje
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name and Email Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <input
                    type="text"
                    name="fullName"
                    placeholder="Nombre completo"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-gray-600 text-white placeholder-gray-400 focus:border-white focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <input
                    type="email"
                    name="email"
                    placeholder="Correo electrónico"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-gray-600 text-white placeholder-gray-400 focus:border-white focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Subject and Phone Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <input
                    type="text"
                    name="subject"
                    placeholder="Asunto"
                    value={formData.subject}
                    onChange={handleInputChange}
                    required
                    className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-gray-600 text-white placeholder-gray-400 focus:border-white focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <input
                    type="tel"
                    name="phone"
                    placeholder="Número de teléfono"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-gray-600 text-white placeholder-gray-400 focus:border-white focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Message */}
              <div>
                <textarea
                  name="message"
                  placeholder="Mensaje"
                  rows={6}
                  value={formData.message}
                  onChange={handleInputChange}
                  required
                  className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-gray-600 text-white placeholder-gray-400 focus:border-white focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Terms and Submit */}
              <div className="space-y-6">
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={formData.agreeToTerms}
                    onChange={handleCheckboxChange}
                    required
                    className="mt-1 w-4 h-4 rounded border-gray-600 bg-transparent focus:ring-blue-500 focus:ring-2"
                  />
                  <label htmlFor="terms" className="text-gray-300 text-sm">
                    Al marcar esta casilla, aceptas el uso de nuestros términos del "Formulario" 
                    y consientes el uso de cookies en el navegador.
                  </label>
                </div>

                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors w-full sm:w-auto"
                  disabled={!formData.agreeToTerms}
                >
                  <span>Enviar Mensaje</span>
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </form>
          </div>

          {/* Right side - Contact Information */}
          <div className="lg:text-right lg:pl-12">
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-8">
              Encuéntranos
            </h2>

            <div className="space-y-8">
              {/* Location */}
              <div>
                <h3 className="text-xl font-semibold mb-3">Nuestra Ubicación</h3>
                <p className="text-gray-300 leading-relaxed">
                  Calle 50 #25-30, Oficina 201<br />
                  Bucaramanga, Santander, Colombia
                </p>
              </div>

              {/* Email */}
              <div>
                <h3 className="text-xl font-semibold mb-3">Correo Electrónico</h3>
                <a 
                  href="mailto:info@administracionsegura.com" 
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  info@administracionsegura.com
                </a>
              </div>

              {/* Phone */}
              <div>
                <h3 className="text-xl font-semibold mb-3">Número de Teléfono</h3>
                <a 
                  href="tel:+576076543210" 
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  +57 (607) 654-3210
                </a>
              </div>

              {/* Office Hours */}
              <div>
                <h3 className="text-xl font-semibold mb-3">Horarios de Atención</h3>
                <div className="text-gray-300 space-y-1">
                  <p>Lunes a Viernes: 8:00 AM - 6:00 PM</p>
                  <p>Sábados: 9:00 AM - 1:00 PM</p>
                  <p>Domingos: Cerrado</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}