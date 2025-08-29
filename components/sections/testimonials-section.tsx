import TestimonialSlider from '@/components/testimonial-slider-new'

export default function TestimonialsSection() {
  return (
    <section className="py-20 bg-white" id="testimonials" style={{ fontFamily: "Reckless, serif" }}>
      <div className="text-center mb-12">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-4">
          <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>CONFIANZA DE EMPRESAS LÍDERES
        </span>
        <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight max-w-3xl mx-auto">
          Ayudando a empresas como la tuya a simplificar su Seguridad Social
        </h2>
      </div>

      <TestimonialSlider />
    </section>
  )
}