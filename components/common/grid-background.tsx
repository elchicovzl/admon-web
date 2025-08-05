interface GridBackgroundProps {
  opacity?: number
  fadeOverlay?: boolean
  className?: string
}

export default function GridBackground({ 
  opacity = 0.6, 
  fadeOverlay = true,
  className = ""
}: GridBackgroundProps) {
  return (
    <div className={`absolute inset-0 ${className}`} style={{ opacity }}>
      <div
        className="w-full h-full"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.15) 1px, transparent 1px)
          `,
          backgroundSize: "30px 30px",
        }}
      />
      {fadeOverlay && (
        <>
          <div className="absolute inset-0 bg-gradient-to-r from-white via-transparent to-white opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white opacity-30" />
        </>
      )}
    </div>
  )
}