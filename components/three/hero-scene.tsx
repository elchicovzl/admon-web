"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Float, Html, Lightformer, Sparkles } from '@react-three/drei'
import * as THREE from 'three'

// Brand tokens (mirrors --brand-navy / --brand-gold in app/globals.css)
const NAVY = '#012A61'
const GOLD = '#E0A025'

interface ServiceCard {
  title: string
  subtitle?: string
  position: [number, number, number]
}

// Ordered by priority: small viewports render only the first entries
const SERVICE_CARDS: ServiceCard[] = [
  { title: 'Afiliaciones', subtitle: 'EPS, ARL, Pensión', position: [-1.9, 1.55, 0.8] },
  { title: 'ARL', subtitle: 'Afiliación y traslados', position: [1.9, 1.7, -0.3] },
  { title: 'Incapacidades', subtitle: 'Gestión y seguimiento', position: [0.5, -1.95, 1.2] },
  { title: 'Pensión', subtitle: 'Asesoría y trámites', position: [2.1, -0.2, 0.9] },
  { title: 'Caja de compensación', position: [-2.0, -0.55, -0.2] },
]

/** Shield outline, centered on the origin and `height` units tall. */
function createShieldShape(width = 2, height = 2.4) {
  const w = width / 2
  const h = height / 2
  const shape = new THREE.Shape()
  shape.moveTo(0, h)
  shape.bezierCurveTo(w * 0.35, h * 0.9, w * 0.75, h * 0.82, w, h * 0.78)
  shape.lineTo(w, h * 0.05)
  shape.bezierCurveTo(w, -h * 0.5, w * 0.45, -h * 0.82, 0, -h)
  shape.bezierCurveTo(-w * 0.45, -h * 0.82, -w, -h * 0.5, -w, h * 0.05)
  shape.lineTo(-w, h * 0.78)
  shape.bezierCurveTo(-w * 0.75, h * 0.82, -w * 0.35, h * 0.9, 0, h)
  return shape
}

/** Thick check mark drawn as a single closed polygon. */
function createCheckShape() {
  const shape = new THREE.Shape()
  shape.moveTo(-0.55, -0.02)
  shape.lineTo(-0.15, -0.42)
  shape.lineTo(0.55, 0.28)
  shape.lineTo(0.41, 0.42)
  shape.lineTo(-0.15, -0.14)
  shape.lineTo(-0.41, 0.12)
  shape.closePath()
  return shape
}

function Shield() {
  const { outer, inner, check } = useMemo(() => {
    const extrude = (shape: THREE.Shape, depth: number, bevel: number) =>
      new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 4,
        curveSegments: 32,
      })
    return {
      outer: extrude(createShieldShape(2, 2.4), 0.22, 0.05),
      inner: extrude(createShieldShape(1.72, 2.1), 0.3, 0.05),
      check: extrude(createCheckShape(), 0.1, 0.025),
    }
  }, [])

  useEffect(() => () => {
    outer.dispose()
    inner.dispose()
    check.dispose()
  }, [outer, inner, check])

  return (
    <group>
      {/* Gold rim */}
      <mesh geometry={outer} position={[0, 0, -0.11]}>
        <meshStandardMaterial color={GOLD} metalness={1} roughness={0.28} />
      </mesh>
      {/* Navy face, slightly proud of the rim */}
      <mesh geometry={inner} position={[0, 0, -0.05]}>
        <meshPhysicalMaterial
          color={NAVY}
          metalness={0.75}
          roughness={0.22}
          clearcoat={1}
          clearcoatRoughness={0.15}
        />
      </mesh>
      {/* Gold check mark emblem */}
      <mesh geometry={check} position={[0, 0.05, 0.3]} scale={1.15}>
        <meshStandardMaterial color={GOLD} metalness={1} roughness={0.25} />
      </mesh>
    </group>
  )
}

function Card({ title, subtitle }: Pick<ServiceCard, 'title' | 'subtitle'>) {
  return (
    <div className="pointer-events-none flex w-[190px] select-none items-center gap-3 rounded-xl border-l-4 border-brand-gold bg-white px-4 py-3 shadow-xl shadow-black/30">
      <div className="min-w-0">
        <p className="text-[15px] font-bold leading-tight text-brand-navy">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs leading-snug text-slate-500">{subtitle}</p>}
      </div>
    </div>
  )
}

interface RigProps {
  pointer: React.RefObject<{ x: number; y: number }>
  reduced: boolean
  cardCount: number
  sparkleCount: number
}

/** Everything inside the canvas: rig that reacts to the pointer + shield + cards. */
function Rig({ pointer, reduced, cardCount, sparkleCount }: RigProps) {
  const group = useRef<THREE.Group>(null)
  const shield = useRef<THREE.Group>(null)

  useFrame((state, delta) => {
    if (reduced) return
    const k = 1 - Math.exp(-delta * 3) // frame-rate independent lerp factor
    if (group.current) {
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, pointer.current.x * 0.35, k)
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -pointer.current.y * 0.2, k)
    }
    if (shield.current) {
      // Slow oscillating turn keeps the face readable instead of a full spin
      shield.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.35
    }
  })

  const floatOn = !reduced

  return (
    <group ref={group}>
      <group ref={shield}>
        <Float speed={floatOn ? 1.4 : 0} rotationIntensity={0} floatIntensity={floatOn ? 0.6 : 0}>
          <Shield />
        </Float>
      </group>

      {SERVICE_CARDS.slice(0, cardCount).map((card, i) => (
        <Float
          key={card.title}
          speed={floatOn ? 1 + (i % 3) * 0.3 : 0}
          rotationIntensity={0}
          floatIntensity={floatOn ? 0.8 : 0}
          position={card.position}
        >
          <Html transform scale={0.27} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
            <Card title={card.title} subtitle={card.subtitle} />
          </Html>
        </Float>
      ))}

      <Sparkles
        count={sparkleCount}
        scale={[7, 5, 3]}
        size={3}
        speed={floatOn ? 0.4 : 0}
        opacity={0.8}
        color={GOLD}
      />
    </group>
  )
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export default function HeroScene() {
  const container = useRef<HTMLDivElement>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const [visible, setVisible] = useState(true)
  const [small, setSmall] = useState(false)
  const reduced = usePrefersReducedMotion()

  // Pause rendering while off-screen
  useEffect(() => {
    const el = container.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Lighter scene on narrow viewports
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    setSmall(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setSmall(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Normalized pointer position (-1..1) relative to the viewport
  useEffect(() => {
    if (reduced) return
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [reduced])

  const frameloop = !visible ? 'never' : reduced ? 'demand' : 'always'

  return (
    <div ref={container} className="relative h-full w-full overflow-hidden" aria-hidden="true">
      <Canvas
        key={small ? 'small' : 'large'}
        frameloop={frameloop}
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, small ? 9.5 : 7.5], fov: 40 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 4, 5]} intensity={2} />
        <directionalLight position={[-4, -2, 3]} intensity={0.8} color={GOLD} />
        <Environment resolution={256}>
          <Lightformer form="rect" intensity={4} position={[0, 4, 4]} scale={[8, 3, 1]} />
          <Lightformer form="rect" intensity={2} position={[-5, 0, 2]} scale={[2, 6, 1]} />
          <Lightformer form="rect" intensity={2} color={GOLD} position={[5, -1, 2]} scale={[2, 5, 1]} />
        </Environment>
        <Rig
          pointer={pointer}
          reduced={reduced}
          cardCount={small ? 3 : SERVICE_CARDS.length}
          sparkleCount={small ? 20 : 45}
        />
      </Canvas>
    </div>
  )
}
