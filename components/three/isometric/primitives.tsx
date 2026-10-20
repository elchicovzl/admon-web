"use client"

import { useEffect, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'

/** Matte "clay" material shared by every prop in the scene. */
export function Clay({ color, roughness = 0.7 }: { color: string; roughness?: number }) {
  return <meshStandardMaterial color={color} roughness={roughness} metalness={0.05} />
}

interface BobProps {
  children: ReactNode
  reduced: boolean
  amplitude?: number
  speed?: number
  phase?: number
}

/** Gentle vertical float; rests at its origin when motion is reduced. */
export function Bob({ children, reduced, amplitude = 0.08, speed = 1.5, phase = 0 }: BobProps) {
  const ref = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (reduced || !ref.current) return
    ref.current.position.y = Math.sin(clock.elapsedTime * speed + phase) * amplitude
  })

  useEffect(() => {
    if (reduced && ref.current) ref.current.position.y = 0
  }, [reduced])

  return <group ref={ref}>{children}</group>
}
