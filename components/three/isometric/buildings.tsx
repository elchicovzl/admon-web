"use client"

import type { ReactNode } from 'react'
import { Html, RoundedBox } from '@react-three/drei'
import { Bob, Clay } from './primitives'
import { CREAM, GOLD, LAWN, LAWN_TOP, NAVY, PLATFORM_SIZE, WHITE, type ServiceConfig } from './constants'

interface WindowRowProps {
  halfWidth: number
  halfDepth: number
  y: number
  columns: number[]
  size?: [number, number]
  color?: string
}

/** Window boxes on the two faces visible from the isometric camera (+X and +Z). */
function WindowRow({ halfWidth, halfDepth, y, columns, size = [0.4, 0.42], color = NAVY }: WindowRowProps) {
  const [w, h] = size
  return (
    <>
      {columns.map((c) => (
        <group key={c}>
          <mesh position={[c, y, halfDepth + 0.01]}>
            <boxGeometry args={[w, h, 0.05]} />
            <Clay color={color} roughness={0.35} />
          </mesh>
          <mesh position={[halfWidth + 0.01, y, c]}>
            <boxGeometry args={[0.05, h, w]} />
            <Clay color={color} roughness={0.35} />
          </mesh>
        </group>
      ))}
    </>
  )
}

/** Floating cream slab with a gold edge strip, lawn inlay and contact shadow handled by the parent. */
export function Platform() {
  return (
    <group>
      <RoundedBox args={[PLATFORM_SIZE, 0.6, PLATFORM_SIZE]} radius={0.22} smoothness={4} position-y={-0.3} receiveShadow castShadow>
        <Clay color={CREAM} roughness={0.8} />
      </RoundedBox>
      {/* Gold edge strip */}
      <RoundedBox args={[PLATFORM_SIZE + 0.14, 0.16, PLATFORM_SIZE + 0.14]} radius={0.08} smoothness={3} position-y={-0.38}>
        <meshStandardMaterial color={GOLD} roughness={0.35} metalness={0.35} />
      </RoundedBox>
      {/* Lawn inlay */}
      <RoundedBox args={[PLATFORM_SIZE - 0.8, 0.1, PLATFORM_SIZE - 0.8]} radius={0.12} smoothness={3} position-y={LAWN_TOP - 0.05} receiveShadow>
        <Clay color={LAWN} roughness={0.9} />
      </RoundedBox>
    </group>
  )
}

function Pill({ children, tone = 'white' }: { children: ReactNode; tone?: 'white' | 'gold' }) {
  return (
    <span
      className={`pointer-events-none select-none whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-md shadow-black/25 ${
        tone === 'gold' ? 'bg-brand-gold text-brand-navy' : 'bg-white text-brand-navy'
      }`}
    >
      {children}
    </span>
  )
}

interface ServiceBuildingProps {
  service: ServiceConfig
  icon: ReactNode
}

/** Compact white block with a colored roof cap, windows, an icon on top and a label pill. */
export function ServiceBuilding({ service, icon }: ServiceBuildingProps) {
  const [x, z] = service.position
  return (
    <group position={[x, LAWN_TOP, z]}>
      <mesh castShadow receiveShadow position-y={0.65}>
        <boxGeometry args={[1.9, 1.3, 1.9]} />
        <Clay color={WHITE} roughness={0.75} />
      </mesh>
      <RoundedBox args={[2.1, 0.16, 2.1]} radius={0.05} smoothness={3} position-y={1.38} castShadow>
        <Clay color={service.accent} roughness={0.55} />
      </RoundedBox>
      <WindowRow halfWidth={0.95} halfDepth={0.95} y={0.75} columns={[-0.4, 0.4]} />
      <group position-y={1.46}>{icon}</group>
      <Html position={[0, 2.85, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <Pill>{service.label}</Pill>
      </Html>
    </group>
  )
}

/** Administración Segura headquarters, with a floating gold badge on top. */
export function Office({ reduced, showLabel }: { reduced: boolean; showLabel: boolean }) {
  return (
    <group position-y={LAWN_TOP}>
      <mesh castShadow receiveShadow position-y={1}>
        <boxGeometry args={[2.4, 2, 2.4]} />
        <Clay color={WHITE} roughness={0.75} />
      </mesh>
      {/* Gold band */}
      <mesh position-y={1.22}>
        <boxGeometry args={[2.46, 0.14, 2.46]} />
        <meshStandardMaterial color={GOLD} roughness={0.4} metalness={0.3} />
      </mesh>
      <RoundedBox args={[2.7, 0.22, 2.7]} radius={0.06} smoothness={3} position-y={2.11} castShadow>
        <Clay color={NAVY} roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[1.4, 0.4, 1.4]} radius={0.06} smoothness={3} position-y={2.42} castShadow>
        <Clay color={NAVY} roughness={0.5} />
      </RoundedBox>
      <WindowRow halfWidth={1.2} halfDepth={1.2} y={1.6} columns={[-0.7, 0, 0.7]} size={[0.45, 0.5]} />
      <WindowRow halfWidth={1.2} halfDepth={1.2} y={0.75} columns={[-0.7, 0.7]} size={[0.45, 0.5]} />
      {/* Doors */}
      <mesh position={[0, 0.4, 1.21]}>
        <boxGeometry args={[0.5, 0.8, 0.05]} />
        <Clay color={GOLD} />
      </mesh>
      <mesh position={[1.21, 0.4, 0]}>
        <boxGeometry args={[0.05, 0.8, 0.5]} />
        <Clay color={GOLD} />
      </mesh>

      {/* Floating logo badge */}
      <group position-y={3.35} rotation-y={Math.PI / 4}>
        <Bob reduced={reduced} amplitude={0.1} speed={1.2}>
          <mesh castShadow rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.46, 0.46, 0.1, 32]} />
            <meshStandardMaterial color={GOLD} roughness={0.3} metalness={0.5} />
          </mesh>
          <mesh position-z={0.03} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.34, 0.34, 0.12, 32]} />
            <Clay color={NAVY} roughness={0.4} />
          </mesh>
          <group position-z={0.1}>
            <mesh position={[-0.09, -0.04, 0]} rotation-z={-Math.PI / 4}>
              <boxGeometry args={[0.1, 0.22, 0.04]} />
              <meshStandardMaterial color={GOLD} roughness={0.3} metalness={0.5} />
            </mesh>
            <mesh position={[0.07, 0.02, 0]} rotation-z={Math.PI / 4}>
              <boxGeometry args={[0.1, 0.4, 0.04]} />
              <meshStandardMaterial color={GOLD} roughness={0.3} metalness={0.5} />
            </mesh>
          </group>
        </Bob>
      </group>
      {showLabel && (
        <Html position={[0, 4.35, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <Pill tone="gold">Administración Segura</Pill>
        </Html>
      )}
    </group>
  )
}

function Tree({ position, scale = 1 }: { position: [number, number]; scale?: number }) {
  return (
    <group position={[position[0], LAWN_TOP, position[1]]} scale={scale}>
      <mesh castShadow position-y={0.2}>
        <cylinderGeometry args={[0.09, 0.12, 0.4, 8]} />
        <Clay color="#9A6B3F" />
      </mesh>
      <mesh castShadow position-y={0.7}>
        <coneGeometry args={[0.46, 0.8, 14]} />
        <Clay color="#4FA84B" />
      </mesh>
      <mesh castShadow position-y={1.1}>
        <coneGeometry args={[0.34, 0.65, 14]} />
        <Clay color="#6BBF59" />
      </mesh>
    </group>
  )
}

function Bush({ position }: { position: [number, number] }) {
  return (
    <mesh castShadow position={[position[0], LAWN_TOP + 0.2, position[1]]}>
      <sphereGeometry args={[0.3, 16, 12]} />
      <Clay color="#7CCB63" roughness={0.9} />
    </mesh>
  )
}

/** A few trees and bushes in the free spots of the lawn (skipped on small screens). */
export function Greenery() {
  return (
    <>
      <Tree position={[-4.4, 1.2]} />
      <Tree position={[4.4, -1.3]} scale={0.9} />
      <Tree position={[1.5, 4.5]} scale={0.8} />
      <Tree position={[-1.4, -4.5]} scale={1.05} />
      <Bush position={[-1.8, 1.6]} />
      <Bush position={[1.9, -1.6]} />
      <Bush position={[2.2, 1.7]} />
    </>
  )
}
