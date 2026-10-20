"use client"

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Billboard } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Clay } from './primitives'
import { sampleRoute, type Route } from './route'
import { GOLD, LAWN_TOP, NAVY, PATH, WHITE } from './constants'

const PATH_WIDTH = 0.55
const PATH_HEIGHT = 0.04

const CYCLE = 7 // seconds for a full office -> service -> check -> restart loop
const TRAVEL = 3.4 // seconds a token needs to reach the building
const TOKEN_GAP = 0.9 // seconds between tokens on the same route
const REST_DISTANCE = 1.5 // how far before the building tokens rest when motion is reduced
const CHECK_POP = 0.5
const CHECK_HOLD = 2.2
const CHECK_FADE = 0.3

const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

/** Flat sand-colored strips following each route, with extra squares to round the corners. */
export function Paths({ routes }: { routes: Route[] }) {
  return (
    <group>
      {routes.map((route, r) =>
        route.points.slice(1).map((end, i) => {
          const start = route.points[i]
          const dx = end.x - start.x
          const dz = end.z - start.z
          return (
            <mesh
              key={`${r}-${i}`}
              receiveShadow
              position={[(start.x + end.x) / 2, LAWN_TOP + PATH_HEIGHT / 2, (start.z + end.z) / 2]}
            >
              <boxGeometry args={[Math.abs(dx) + PATH_WIDTH, PATH_HEIGHT, Math.abs(dz) + PATH_WIDTH]} />
              <Clay color={PATH} roughness={0.9} />
            </mesh>
          )
        }),
      )}
    </group>
  )
}

/** Thin white document with a navy text line. */
function DocumentToken() {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.36, 0.05, 0.48]} />
        <Clay color={WHITE} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.03, 0.08]}>
        <boxGeometry args={[0.24, 0.02, 0.05]} />
        <Clay color={NAVY} />
      </mesh>
      <mesh position={[0, 0.03, -0.04]}>
        <boxGeometry args={[0.24, 0.02, 0.05]} />
        <Clay color={NAVY} />
      </mesh>
      <mesh position={[0, 0.03, -0.16]}>
        <boxGeometry args={[0.14, 0.02, 0.05]} />
        <Clay color={GOLD} />
      </mesh>
    </group>
  )
}

/** Gold coin with a white check, always facing the camera. */
function CheckBadge() {
  return (
    <Billboard>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.34, 0.34, 0.08, 28]} />
        <meshStandardMaterial color={GOLD} roughness={0.3} metalness={0.45} />
      </mesh>
      <group position-z={0.06}>
        <mesh position={[-0.1, -0.04, 0]} rotation-z={-Math.PI / 4}>
          <boxGeometry args={[0.08, 0.2, 0.04]} />
          <Clay color={WHITE} roughness={0.4} />
        </mesh>
        <mesh position={[0.06, 0.02, 0]} rotation-z={Math.PI / 4}>
          <boxGeometry args={[0.08, 0.36, 0.04]} />
          <Clay color={WHITE} roughness={0.4} />
        </mesh>
      </group>
    </Billboard>
  )
}

interface RouteFlowProps {
  route: Route
  /** Seconds added to the clock so routes are staggered */
  delay: number
  tokenCount: number
  reduced: boolean
  checkY: number
}

/** Documents travelling office -> service; a gold check pops when the first one arrives. */
export function RouteFlow({ route, delay, tokenCount, reduced, checkY }: RouteFlowProps) {
  const tokens = useRef<Array<THREE.Group | null>>([])
  const check = useRef<THREE.Group>(null)
  const invalidate = useThree((s) => s.invalidate)
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const end = route.points[route.points.length - 1]

  /** Poses tokens and check for a point in time; `still` renders the resting "all done" frame. */
  const pose = useCallback(
    (time: number, still: boolean) => {
      for (let i = 0; i < tokenCount; i++) {
        const token = tokens.current[i]
        if (!token) continue

        if (still) {
          const heading = sampleRoute(route, route.total - REST_DISTANCE - i * 0.55, tmp)
          token.visible = true
          token.position.copy(tmp)
          token.rotation.y = heading
          token.scale.setScalar(1)
          continue
        }

        const local = (((time + delay - i * TOKEN_GAP) % CYCLE) + CYCLE) % CYCLE
        if (local >= TRAVEL) {
          token.visible = false
          continue
        }
        const heading = sampleRoute(route, (local / TRAVEL) * route.total, tmp)
        token.visible = true
        token.position.copy(tmp)
        token.position.y += Math.abs(Math.sin(local * 5)) * 0.07
        token.rotation.y = heading
        token.scale.setScalar(Math.min(1, local / 0.3))
      }

      if (check.current) {
        const since = ((((time + delay) % CYCLE) + CYCLE) % CYCLE) - TRAVEL
        let scale = 0
        if (still) scale = 1
        else if (since >= 0 && since < CHECK_POP) scale = easeOutBack(since / CHECK_POP)
        else if (since >= CHECK_POP && since < CHECK_HOLD) scale = 1
        else if (since >= CHECK_HOLD && since < CHECK_HOLD + CHECK_FADE) scale = 1 - (since - CHECK_HOLD) / CHECK_FADE
        check.current.scale.setScalar(Math.max(scale, 0.0001))
      }
    },
    [route, tmp, tokenCount, delay],
  )

  useFrame(({ clock }) => {
    if (!reduced) pose(clock.elapsedTime, false)
  })

  // Reduced motion: freeze on the completed frame
  useEffect(() => {
    if (!reduced) return
    pose(0, true)
    invalidate()
  }, [reduced, pose, invalidate])

  return (
    <group>
      {Array.from({ length: tokenCount }, (_, i) => (
        <group
          key={i}
          visible={false}
          ref={(el) => {
            tokens.current[i] = el
          }}
        >
          <DocumentToken />
        </group>
      ))}
      <group ref={check} position={[end.x, checkY, end.z]} scale={0.0001}>
        <CheckBadge />
      </group>
    </group>
  )
}

const DUST_COUNT = 16

/** Tiny floating gold motes above the platform. */
export function GoldDust({ reduced }: { reduced: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const invalidate = useThree((s) => s.invalidate)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Deterministic scatter so renders are reproducible
  const motes = useMemo(
    () =>
      Array.from({ length: DUST_COUNT }, (_, i) => {
        const a = Math.sin(i * 12.9898) * 43758.5453
        const b = Math.sin(i * 78.233) * 12345.6789
        const c = Math.sin(i * 39.346) * 9876.5432
        const frac = (n: number) => n - Math.floor(n)
        return {
          x: (frac(a) - 0.5) * 10,
          y: 1.2 + frac(b) * 3,
          z: (frac(c) - 0.5) * 10,
          speed: 0.5 + frac(a + b) * 0.8,
          phase: frac(c + b) * Math.PI * 2,
        }
      }),
    [],
  )

  const update = useCallback(
    (time: number) => {
      if (!mesh.current) return
      motes.forEach((m, i) => {
        dummy.position.set(m.x, m.y + Math.sin(time * m.speed + m.phase) * 0.25, m.z)
        dummy.scale.setScalar(0.8 + Math.sin(time * m.speed * 1.7 + m.phase) * 0.3)
        dummy.updateMatrix()
        mesh.current!.setMatrixAt(i, dummy.matrix)
      })
      mesh.current.instanceMatrix.needsUpdate = true
    },
    [dummy, motes],
  )

  useFrame(({ clock }) => {
    if (!reduced) update(clock.elapsedTime)
  })

  useEffect(() => {
    update(0)
    invalidate()
  }, [update, reduced, invalidate])

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, DUST_COUNT]} frustumCulled={false}>
      <sphereGeometry args={[0.055, 8, 8]} />
      <meshBasicMaterial color={GOLD} transparent opacity={0.9} />
    </instancedMesh>
  )
}
