/** Static placeholder: same box as the scene, so there is no layout shift. */
export function HeroSceneFallback() {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(224,160,37,0.22),transparent_60%)]" />
      <svg
        viewBox="0 0 100 120"
        className="absolute left-1/2 top-1/2 h-48 w-40 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
      >
        <path
          d="M50 4 C62 8 80 10 94 12 L94 58 C94 90 70 108 50 116 C30 108 6 90 6 58 L6 12 C20 10 38 8 50 4 Z"
          fill="#012A61"
          stroke="#E0A025"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path d="M30 60 L44 74 L72 42" fill="none" stroke="#E0A025" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
