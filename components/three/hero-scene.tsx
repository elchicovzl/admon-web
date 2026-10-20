"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { HeroSceneFallback } from './hero-scene-fallback'
import { Greenery, Office, Platform, ServiceBuilding } from './isometric/buildings'
import { GoldDust, Paths, RouteFlow } from './isometric/flow'
import { HardHat, HealthCross, LittleHouse, PiggyBank } from './isometric/icons'
import { buildRoute, SERVICES, TOKEN_Y, type ServiceId } from './isometric/constants'

// True isometric angle: the camera sits on the cube diagonal and never moves
const CAMERA_POSITION: [number, number, number] = [10, 10, 10]
const PARALLAX_MAX = 0.15 // radians of world yaw at the screen edge
const SWAY_AMPLITUDE = 0.04
// World extent on screen (in world units) used to fit the zoom to the container
const FIT_WIDTH = 16.5
const FIT_WIDTH_SMALL = 15.8
const FIT_HEIGHT = 13

const ICONS: Record<ServiceId, (props: { reduced: boolean }) => React.ReactNode> = {
  eps: (p) => <HealthCross {...p} />,
  arl: (p) => <HardHat {...p} />,
  pension: (p) => <PiggyBank {...p} />,
  caja: (p) => <LittleHouse {...p} />,
}

interface RigProps {
  pointer: React.RefObject<{ x: number; y: number }>
  reduced: boolean
  small: boolean
}

/** The whole mini-world: pointer parallax + idle sway wrap every scene element. */
function Rig({ pointer, reduced, small }: RigProps) {
  const world = useRef<THREE.Group>(null)
  const routes = useMemo(() => SERVICES.map((s) => buildRoute(s, TOKEN_Y)), [])

  useFrame((state, delta) => {
    if (reduced || !world.current) return
    const k = 1 - Math.exp(-delta * 3) // frame-rate independent lerp factor
    const target = pointer.current.x * PARALLAX_MAX + Math.sin(state.clock.elapsedTime * 0.35) * SWAY_AMPLITUDE
    world.current.rotation.y = THREE.MathUtils.lerp(world.current.rotation.y, target, k)
  })

  // Return to the neutral pose when motion gets reduced
  useEffect(() => {
    if (reduced && world.current) world.current.rotation.y = 0
  }, [reduced])

  return (
    <>
      <group ref={world}>
        <Platform />
        <Paths routes={routes} />
        <Office reduced={reduced} showLabel={!small} />
        {SERVICES.map((service, i) => (
          <group key={service.id}>
            <ServiceBuilding service={service} icon={ICONS[service.id]({ reduced })} />
            <RouteFlow
              route={routes[i]}
              delay={i * 1.75}
              tokenCount={small ? 1 : 2}
              reduced={reduced}
              checkY={3.7}
            />
          </group>
        ))}
        {!small && <Greenery />}
        {!small && <GoldDust reduced={reduced} />}
      </group>
      {/* Soft shadow under the floating slab; static, so a single render is enough */}
      <ContactShadows position={[0, -1.1, 0]} scale={18} blur={2.8} far={3} opacity={0.55} resolution={512} frames={1} color="#000814" />
    </>
  )
}

// This module is only loaded client-side (ssr:false), so reading `window` in lazy
// initializers is safe and avoids a first render with the wrong variant.
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return !!gl
  } catch {
    return false
  }
}

interface SceneSyncProps {
  small: boolean
  visible: boolean
  reduced: boolean
}

/** Fits the orthographic zoom to the container and keeps the demand frameloop fresh. */
function SceneSync({ small, visible, reduced }: SceneSyncProps) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    const ortho = camera as THREE.OrthographicCamera
    ortho.zoom = Math.min(size.width / (small ? FIT_WIDTH_SMALL : FIT_WIDTH), size.height / FIT_HEIGHT)
    ortho.updateProjectionMatrix()
    invalidate()
  }, [camera, size.width, size.height, small, invalidate])

  // Re-render after visibility / motion / content changes. Extra delayed frames cover
  // async work (Html mounting, shadow maps) when the frameloop is on demand.
  useEffect(() => {
    if (!visible) return
    invalidate()
    const timers = [100, 400, 1000].map((ms) => window.setTimeout(invalidate, ms))
    return () => timers.forEach(window.clearTimeout)
  }, [visible, reduced, small, invalidate])

  return null
}

export default function HeroScene() {
  const container = useRef<HTMLDivElement>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const [visible, setVisible] = useState(true)
  const [small, setSmall] = useState(() => window.matchMedia('(max-width: 640px)').matches)
  const [failed, setFailed] = useState(() => !hasWebGL())
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

  if (failed) return <HeroSceneFallback />

  const frameloop = !visible ? 'never' : reduced ? 'demand' : 'always'

  return (
    <div ref={container} className="relative h-full w-full overflow-hidden" aria-hidden="true">
      {/* Warm glow so the light platform lifts off the navy background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(224,160,37,0.16),transparent_62%)]" />
      <Canvas
        shadows
        orthographic
        frameloop={frameloop}
        dpr={[1, 1.75]}
        camera={{ position: CAMERA_POSITION, zoom: 40, near: 0.1, far: 100 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault()
            setFailed(true)
          })
        }}
      >
        <SceneSync small={small} visible={visible} reduced={reduced} />
        {/* Bright, warm lighting: sky white / navy ground bounce + warm key with soft shadows */}
        <hemisphereLight args={['#FFFFFF', '#3B5A8C', 1.1]} />
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[6, 11, 5]}
          intensity={2.4}
          color="#FFF1D6"
          castShadow={!small}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-9}
          shadow-camera-right={9}
          shadow-camera-top={9}
          shadow-camera-bottom={-9}
          shadow-camera-near={1}
          shadow-camera-far={30}
          shadow-bias={-0.0005}
          shadow-normalBias={0.04}
        />
        <Rig pointer={pointer} reduced={reduced} small={small} />
      </Canvas>
    </div>
  )
}
