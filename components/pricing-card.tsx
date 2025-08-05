import type React from "react"
import { CheckCircle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PricingCardProps {
  title: string
  description: string
  price: string
  oldPrice?: string
  deliveryTime: string
  features: string[]
  isBestValue?: boolean
  noCreditCard?: boolean
  bgColor: string
  textColor: string
  icon: React.ReactNode
  buttonText: string
}

export default function PricingCard({
  title,
  description,
  price,
  oldPrice,
  deliveryTime,
  features,
  isBestValue,
  noCreditCard,
  bgColor,
  textColor,
  icon,
  buttonText,
}: PricingCardProps) {
  return (
    <div className={cn("relative flex flex-col p-8 rounded-xl shadow-lg border border-gray-200", bgColor, textColor)}>
      {isBestValue && (
        <div className="absolute -top-3 right-6 bg-black text-white text-xs font-medium px-3 py-1 rounded-full flex items-center space-x-1">
          <span className="w-2 h-2 bg-white rounded-full" />
          <span>Best Value</span>
        </div>
      )}
      {noCreditCard && (
        <div className="absolute -top-3 right-6 bg-white border border-gray-300 text-gray-700 text-xs font-medium px-3 py-1 rounded-full flex items-center space-x-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full" />
          <span>No credit card required</span>
        </div>
      )}

      <div className="mb-6">
        <div className="mb-4">{icon}</div>
        <h3 className="text-2xl font-bold mb-2">{title}</h3>
        <p className="text-gray-600 text-sm">{description}</p>
      </div>

      <div className="mb-6">
        {oldPrice && <p className="text-gray-500 line-through text-lg">{oldPrice}</p>}
        <p className="text-4xl font-bold mb-1">
          {price} <span className="text-lg font-normal text-gray-600">USD</span>
        </p>
        <p className="text-sm text-gray-600">{deliveryTime}</p>
      </div>

      <div className="flex flex-col space-y-3 mb-8">
        <Button className="bg-black text-white hover:bg-gray-800 rounded-full px-6 py-3 text-base font-medium">
          {buttonText}
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          className="rounded-full px-6 py-3 text-base font-medium border-2 border-gray-300 hover:bg-gray-50 bg-transparent text-gray-900"
        >
          Book a call
        </Button>
      </div>

      <ul className="space-y-3 text-gray-700">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center text-sm">
            <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
            <span className={cn({ "border-b border-dashed border-gray-300": feature.includes("dashed") })}>
              {feature.replace(" (dashed)", "")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
