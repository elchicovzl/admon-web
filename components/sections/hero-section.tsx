"use client"

import { Button } from '@/components/ui/button'
import { ArrowRight, Eye, TrendingUp } from 'lucide-react'
import { Typewriter } from 'react-simple-typewriter'
import MotionCarousel from '@/components/ui/motion-carousel'
import Squares from '@/components/ui/squares-background'

export default function HeroSection() {
  return (
    <section className="relative py-20 overflow-hidden bg-white">
      {/* Squares Background */}
      <div className="absolute inset-0 opacity-50">
        <Squares
          direction="diagonal"
          speed={0.2}
          borderColor="rgba(0,0,0,0.1)"
          squareSize={30}
          hoverFillColor="rgba(0,0,0,0.05)"
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="relative z-10 text-left">
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Soluciones en Seguridad Social para Empresas e Independientes{" "}
            </h1>
            <p className="text-lg md:text-2xl text-gray-600 mb-8 max-w-lg">
              Afiliacion a {' '}
              <span className="font-semibold text-orange-400">
                <Typewriter
                  words={[
                    'EPS (Salud)',
                    'ARL (Riesgos Laborales)',
                    'Fondos de Pensiones',
                    'CCF Caja de Compensación'
                  ]}
                  loop={0}
                  cursor
                  cursorStyle="_"
                  typeSpeed={70}
                  deleteSpeed={50}
                  delaySpeed={1000}
                />
              </span>{' '}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="bg-black text-white hover:bg-gray-800 rounded-full px-8 py-4 text-lg font-medium w-full sm:w-auto"
              >
                Asesorias GRATIS
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full px-8 py-4 text-lg font-medium border-2 border-gray-300 hover:bg-gray-50 bg-transparent w-full sm:w-auto"
              >
                Servicios
                <Eye className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Right side with carousel */}
          <div className="relative z-10 flex justify-center">
            <div className="relative">
              {/* Motion Carousel */}
              <MotionCarousel
                baseWidth={400}
                autoplay={true}
                autoplayDelay={3000}
                pauseOnHover={true}
                loop={true}
                round={true}
              />

              {/* Floating UI elements */}
              {/* +18% Increase CRO card */}
              <div className="absolute -top-4 right-8 bg-blue-100 border border-blue-200 rounded-lg p-3 shadow-lg z-10">
                <div className="text-2xl font-bold text-blue-900">+18%</div>
                <div className="text-sm text-blue-700">Aumento CRO</div>
                <div className="flex items-center mt-1">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-3 h-3 text-white" />
                  </div>
                  <div className="ml-2 flex space-x-1">
                    <div className="w-1 h-4 bg-gray-300 rounded"></div>
                    <div className="w-1 h-6 bg-gray-400 rounded"></div>
                    <div className="w-1 h-8 bg-gray-600 rounded"></div>
                    <div className="w-1 h-5 bg-gray-800 rounded"></div>
                  </div>
                </div>
              </div>

              {/* Brand badge */}
              <div className="absolute bottom-8 right-4 bg-purple-600 text-white rounded-full px-4 py-2 shadow-lg z-10">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 text-white">✦</div>
                  <span className="font-medium font-serif">ADMINISTRACIÓN <span className="text-orange-400 font-serif">SEGURA</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Layout - Text Only */}
        <div className="lg:hidden">
          <div className="relative z-10 text-center py-12">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 leading-tight">
              Soluciones en Seguridad Social para Empresas e Independientes
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Afiliacion a {' '}
              <span className="font-semibold text-orange-400">
                <Typewriter
                  words={[
                    'EPS (Salud)',
                    'ARL (Riesgos Laborales)',
                    'Fondos de Pensiones',
                    'CCF Caja de Compensación'
                  ]}
                  loop={0}
                  cursor
                  cursorStyle="_"
                  typeSpeed={70}
                  deleteSpeed={50}
                  delaySpeed={1000}
                />
              </span>
            </p>
            <div className="flex flex-col gap-4 max-w-md mx-auto">
              <Button
                size="lg"
                className="bg-black text-white hover:bg-gray-800 rounded-full px-8 py-4 text-lg font-medium w-full"
              >
                Asesorias GRATIS
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full px-8 py-4 text-lg font-medium border-2 border-gray-300 hover:bg-gray-50 bg-transparent w-full"
              >
                Servicios
                <Eye className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}