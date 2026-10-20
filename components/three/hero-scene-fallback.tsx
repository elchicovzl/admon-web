interface CubeProps {
  /** Ground point of the block's front corner area (center of its footprint) */
  x: number
  y: number
  w: number
  h: number
  top: string
  left: string
  right: string
}

/** Isometric block: `w` is half the footprint width, `h` the wall height. */
function Cube({ x, y, w, h, top, left, right }: CubeProps) {
  const t = y - h // center of the top face
  const hw = w / 2
  return (
    <g>
      <polygon points={`${x - w},${t} ${x},${t + hw} ${x},${t + hw + h} ${x - w},${t + h}`} fill={left} />
      <polygon points={`${x + w},${t} ${x},${t + hw} ${x},${t + hw + h} ${x + w},${t + h}`} fill={right} />
      <polygon points={`${x},${t - hw} ${x + w},${t} ${x},${t + hw} ${x - w},${t}`} fill={top} />
    </g>
  )
}

/** Static placeholder: same box as the scene, so there is no layout shift. */
export function HeroSceneFallback() {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(224,160,37,0.16),transparent_62%)]" />
      <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
        {/* Platform: gold edge, cream slab, lawn */}
        <polygon points="200,66 372,156 200,246 28,156" fill="#E0A025" />
        <polygon points="200,58 372,148 200,238 28,148" fill="#F7F3EA" />
        <polygon points="200,58 372,148 200,238 28,148" fill="none" stroke="#fff" strokeOpacity="0.5" />
        <polygon points="200,74 346,148 200,222 54,148" fill="#CFE6B8" />
        {/* Paths */}
        <g fill="none" stroke="#E8DEC4" strokeWidth="9" strokeLinejoin="round">
          <polyline points="200,148 200,100" />
          <polyline points="200,148 296,148" />
          <polyline points="200,148 104,148" />
          <polyline points="200,148 200,196" />
        </g>
        {/* Back to front: EPS, Pensión/ARL sides, office, Caja */}
        <Cube x={200} y={104} w={26} h={24} top="#E5484D" left="#EDEDED" right="#FFFFFF" />
        <Cube x={104} y={150} w={26} h={24} top="#F28BA8" left="#EDEDED" right="#FFFFFF" />
        <Cube x={296} y={150} w={26} h={24} top="#E0A025" left="#EDEDED" right="#FFFFFF" />
        <Cube x={200} y={162} w={34} h={46} top="#012A61" left="#E9E6DD" right="#FFFFFF" />
        <Cube x={200} y={200} w={26} h={24} top="#2F6FDB" left="#EDEDED" right="#FFFFFF" />
        {/* Gold badge over the office */}
        <circle cx="200" cy="82" r="9" fill="#E0A025" />
        <circle cx="200" cy="82" r="5.5" fill="#012A61" />
      </svg>
    </div>
  )
}
