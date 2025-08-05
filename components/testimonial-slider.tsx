"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface Testimonial {
  quote: string
  name: string
  title: string
  avatar: string
  bgColor: string
  textColor: string
}

const testimonials: Testimonial[] = [
  {
    quote:
      "Peek Insights is incredibly accommodating and flexible and goes above and beyond to deliver on a brief. They are an asset as a business partner to any company!",
    name: "Lizzie Waley",
    title: "Co-founder, Sundae Body",
    avatar: "/placeholder.svg?height=60&width=60",
    bgColor: "bg-blue-100",
    textColor: "text-gray-900",
  },
  {
    quote:
      "Peek Insights has helped our brand grow significantly. Thanks to their timely efforts, we've seen a substantial increase in online sales and overall brand presence on the platform. Peek Insights truly delivers!",
    name: "Olivia Zorzut",
    title: "Co-founder, The Fox Tan",
    avatar: "/placeholder.svg?height=60&width=60",
    bgColor: "bg-gray-100",
    textColor: "text-gray-600",
  },
  {
    quote:
      "Working with Peek Insights has been a game-changer for our e-commerce business. Their expertise in CRO and design has been an important part of my business's success. I'm so glad to have them in my corner.",
    name: "Sarah Johnson",
    title: "CEO, Fashion Forward",
    avatar: "/placeholder.svg?height=60&width=60",
    bgColor: "bg-gray-100",
    textColor: "text-gray-600",
  },
]

export default function TestimonialSlider() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const sliderRef = useRef<HTMLDivElement>(null)

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
    if (sliderRef.current) {
      const slideWidth = sliderRef.current.children[0].clientWidth
      sliderRef.current.scrollTo({
        left: slideWidth * index,
        behavior: "smooth",
      })
    }
  }

  useEffect(() => {
    if (sliderRef.current) {
      const handleScroll = () => {
        const scrollLeft = sliderRef.current?.scrollLeft || 0
        // Calculate the width of a single card including its margin
        const firstCard = sliderRef.current?.children[0] as HTMLElement
        const cardWidth = firstCard
          ? firstCard.offsetWidth + Number.parseFloat(window.getComputedStyle(firstCard).marginRight)
          : 1

        const newIndex = Math.round(scrollLeft / cardWidth)
        setCurrentIndex(newIndex)
      }
      sliderRef.current.addEventListener("scroll", handleScroll)
      return () => {
        sliderRef.current?.removeEventListener("scroll", handleScroll)
      }
    }
  }, [])

  return (
    <div className="relative w-full overflow-hidden">
      {/* Fade overlays for the slider */}
      <div className="absolute left-0 top-0 w-20 h-full bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 w-20 h-full bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

      <div
        ref={sliderRef}
        className="flex snap-x snap-mandatory overflow-x-scroll scrollbar-hide py-4 -mx-4" // Added -mx-4 to allow partial visibility
        style={{ scrollBehavior: "smooth" }}
      >
        {testimonials.map((testimonial, index) => (
          <div
            key={index}
            className={cn(
              "flex-shrink-0 w-[calc(100%-8rem)] md:w-[calc(50%-4rem)] lg:w-[calc(33.333%-4rem)] mx-4 p-8 rounded-lg shadow-lg snap-center", // Adjusted width and margin
              "aspect-[3/2] md:aspect-[4/2] lg:aspect-[5/2]", // Make cards wider than tall
              testimonial.bgColor,
              testimonial.textColor,
              index === currentIndex ? "opacity-100 scale-100 z-10" : "opacity-30 scale-90", // Adjusted opacity and scale for more fading
              "transition-all duration-300 ease-in-out flex flex-col justify-between", // Added flex for content alignment
            )}
          >
            <p className="text-xl font-medium mb-6 leading-relaxed max-w-prose">{testimonial.quote}</p>
            <div className="flex items-center">
              <Image
                src={testimonial.avatar || "/placeholder.svg"}
                alt={testimonial.name}
                width={48}
                height={48}
                className="rounded-full mr-4"
              />
              <div>
                <p className="font-bold">{testimonial.name}</p>
                <p className="text-sm">{testimonial.title}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center mt-8 space-x-2">
        {testimonials.map((_, index) => (
          <button
            key={index}
            className={cn(
              "w-3 h-3 rounded-full transition-colors duration-300",
              index === currentIndex ? "bg-blue-600" : "bg-gray-300",
            )}
            onClick={() => goToSlide(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
