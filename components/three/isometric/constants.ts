import { createRoute, type Route } from './route'

// Brand tokens (mirrors --brand-navy / --brand-gold in app/globals.css)
export const NAVY = '#012A61'
export const GOLD = '#E0A025'

export const CREAM = '#F7F3EA'
export const WHITE = '#FFFFFF'
export const LAWN = '#CFE6B8'
export const PATH = '#E8DEC4'

/** Y coordinate of the lawn surface; everything standing on the platform starts here. */
export const LAWN_TOP = 0.06
export const PLATFORM_SIZE = 11

export type ServiceId = 'eps' | 'arl' | 'pension' | 'caja'

export interface ServiceConfig {
  id: ServiceId
  label: string
  /** Ground position [x, z] of the building center */
  position: [number, number]
  /** Color of the roof cap */
  accent: string
  /** Whether the route leaves the office along X or Z first (keeps routes from overlapping) */
  axisFirst: 'x' | 'z'
}

const OFFSET = 3.4

export const SERVICES: ServiceConfig[] = [
  { id: 'eps', label: 'EPS', position: [-OFFSET, -OFFSET], accent: '#E5484D', axisFirst: 'x' },
  { id: 'arl', label: 'ARL', position: [OFFSET, -OFFSET], accent: GOLD, axisFirst: 'z' },
  { id: 'pension', label: 'Pensión', position: [-OFFSET, OFFSET], accent: '#F28BA8', axisFirst: 'z' },
  { id: 'caja', label: 'Caja', position: [OFFSET, OFFSET], accent: '#2F6FDB', axisFirst: 'x' },
]

/** L-shaped route from the office center to a service building center. */
export function buildRoute(service: ServiceConfig, y: number): Route {
  const [x, z] = service.position
  const corner: [number, number] = service.axisFirst === 'x' ? [x, 0] : [0, z]
  return createRoute([[0, 0], corner, [x, z]], y)
}

/** Height at which documents travel above the lawn. */
export const TOKEN_Y = LAWN_TOP + 0.45
