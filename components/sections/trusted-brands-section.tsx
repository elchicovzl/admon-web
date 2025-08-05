import { trustedBrands } from '@/data/features'

export default function TrustedBrandsSection() {
  return (
    <section className="py-8 bg-white border-b border-gray-200 overflow-hidden" style={{ fontFamily: "Reckless, serif" }}>
      <div className="relative">
        <div className="flex items-center mb-4 px-4 sm:px-6 lg:px-8">
          <span className="text-sm text-gray-600 whitespace-nowrap">Marcas que confían</span>
          <span className="text-sm text-gray-600 ml-1">en nosotros</span>
        </div>

        {/* Marquee Container */}
        <div className="relative overflow-hidden">
          {/* Fade overlays */}
          <div className="absolute left-0 top-0 w-20 h-full bg-gradient-to-r from-white to-transparent z-10"></div>
          <div className="absolute right-0 top-0 w-20 h-full bg-gradient-to-l from-white to-transparent z-10"></div>

          {/* Scrolling content */}
          <div className="animate-marquee">
            <div className="flex items-center space-x-16 px-8">
              {/* Duplicate brands for smooth infinite scroll */}
              {[...trustedBrands, ...trustedBrands, ...trustedBrands].map((brand, index) => (
                <div 
                  key={`${brand}-${index}`}
                  className="text-2xl font-bold text-gray-400 whitespace-nowrap"
                >
                  {brand}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}