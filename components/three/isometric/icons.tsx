"use client"

import { useEffect, useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { Bob, Clay } from './primitives'
import { GOLD, NAVY } from './constants'

interface IconProps {
  reduced: boolean
}

// Every icon stands on y = 0 of its parent and is yawed so its front faces the camera.
const FACE_CAMERA = Math.PI / 4

/** EPS: floating red health cross. */
export function HealthCross({ reduced }: IconProps) {
  return (
    <group rotation-y={FACE_CAMERA} position-y={0.8}>
      <Bob reduced={reduced} amplitude={0.07} phase={0.5}>
        <RoundedBox args={[1, 0.32, 0.32]} radius={0.09} smoothness={3} castShadow>
          <Clay color="#E5484D" roughness={0.45} />
        </RoundedBox>
        <RoundedBox args={[0.32, 1, 0.32]} radius={0.09} smoothness={3} castShadow>
          <Clay color="#E5484D" roughness={0.45} />
        </RoundedBox>
      </Bob>
    </group>
  )
}

/** ARL: yellow hard hat. */
export function HardHat({ reduced }: IconProps) {
  return (
    <group rotation-y={FACE_CAMERA - 0.5} position-y={0.1}>
      <Bob reduced={reduced} amplitude={0.05} phase={1.4}>
        <mesh castShadow position-y={0.08}>
          <sphereGeometry args={[0.55, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Clay color="#F6B93B" roughness={0.4} />
        </mesh>
        {/* Brim */}
        <mesh castShadow position-y={0.06}>
          <cylinderGeometry args={[0.68, 0.68, 0.07, 32]} />
          <Clay color="#E39F1B" roughness={0.5} />
        </mesh>
        {/* Front peak */}
        <mesh castShadow position={[0, 0.07, 0.62]}>
          <boxGeometry args={[0.5, 0.06, 0.28]} />
          <Clay color="#E39F1B" roughness={0.5} />
        </mesh>
        {/* Center ridge */}
        <mesh castShadow position-y={0.58}>
          <boxGeometry args={[0.16, 0.08, 0.7]} />
          <Clay color="#E39F1B" roughness={0.5} />
        </mesh>
      </Bob>
    </group>
  )
}

/** Pensión: pink piggy bank with a gold coin. */
export function PiggyBank({ reduced }: IconProps) {
  const pink = '#F5A3B8'
  const pinkDark = '#EE86A0'
  const legs: Array<[number, number]> = [
    [-0.27, -0.24],
    [0.27, -0.24],
    [-0.27, 0.24],
    [0.27, 0.24],
  ]

  return (
    <group rotation-y={FACE_CAMERA + 0.5} position-y={0.05}>
      <Bob reduced={reduced} amplitude={0.04} phase={2.2}>
        <mesh castShadow position-y={0.58} scale={[1, 0.92, 1.18]}>
          <sphereGeometry args={[0.5, 32, 24]} />
          <Clay color={pink} roughness={0.55} />
        </mesh>
        {/* Snout */}
        <mesh castShadow position={[0, 0.54, 0.6]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.17, 0.19, 0.16, 20]} />
          <Clay color={pinkDark} />
        </mesh>
        {[-0.05, 0.05].map((x) => (
          <mesh key={x} position={[x, 0.54, 0.685]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <Clay color={NAVY} />
          </mesh>
        ))}
        {/* Ears */}
        {[-1, 1].map((side) => (
          <mesh key={side} castShadow position={[side * 0.22, 0.98, 0.3]} rotation-z={-side * 0.35}>
            <coneGeometry args={[0.13, 0.24, 12]} />
            <Clay color={pinkDark} />
          </mesh>
        ))}
        {/* Eyes */}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.2, 0.74, 0.48]}>
            <sphereGeometry args={[0.05, 10, 10]} />
            <Clay color={NAVY} />
          </mesh>
        ))}
        {/* Legs */}
        {legs.map(([x, z]) => (
          <mesh key={`${x}${z}`} castShadow position={[x, 0.12, z]}>
            <cylinderGeometry args={[0.1, 0.11, 0.26, 12]} />
            <Clay color={pinkDark} />
          </mesh>
        ))}
        {/* Coin slot + tail */}
        <mesh position={[0, 1.04, 0]}>
          <boxGeometry args={[0.32, 0.04, 0.07]} />
          <Clay color="#B5546F" />
        </mesh>
        <mesh position={[0, 0.7, -0.62]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.07, 0.025, 8, 16]} />
          <Clay color={pinkDark} />
        </mesh>
        {/* Coin dropping in */}
        <mesh castShadow position={[0, 1.4, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.2, 0.2, 0.06, 24]} />
          <meshStandardMaterial color={GOLD} roughness={0.3} metalness={0.5} />
        </mesh>
      </Bob>
    </group>
  )
}

/** Caja de compensación: little house with a prism roof. */
export function LittleHouse({ reduced }: IconProps) {
  const roof = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-0.62, 0)
    shape.lineTo(0.62, 0)
    shape.lineTo(0, 0.5)
    shape.closePath()
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1.05, bevelEnabled: false })
    geometry.translate(0, 0, -0.525)
    return geometry
  }, [])

  useEffect(() => () => roof.dispose(), [roof])

  return (
    <group rotation-y={FACE_CAMERA} position-y={0.05}>
      <Bob reduced={reduced} amplitude={0.04} phase={3.1}>
        <mesh castShadow position-y={0.3}>
          <boxGeometry args={[1, 0.6, 0.9]} />
          <Clay color="#FBE9C2" />
        </mesh>
        <mesh castShadow geometry={roof} position-y={0.6}>
          <Clay color="#E8714A" roughness={0.6} />
        </mesh>
        {/* Door, window and chimney */}
        <mesh position={[0, 0.2, 0.46]}>
          <boxGeometry args={[0.22, 0.4, 0.04]} />
          <Clay color={GOLD} />
        </mesh>
        <mesh position={[0.32, 0.36, 0.46]}>
          <boxGeometry args={[0.18, 0.18, 0.04]} />
          <Clay color={NAVY} />
        </mesh>
        <mesh castShadow position={[0.3, 1.0, -0.2]}>
          <boxGeometry args={[0.14, 0.3, 0.14]} />
          <Clay color="#C9573A" />
        </mesh>
      </Bob>
    </group>
  )
}
