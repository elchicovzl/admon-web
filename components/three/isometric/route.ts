import * as THREE from 'three'

export interface Route {
  points: THREE.Vector3[]
  /** Distance from the start to each point */
  cumulative: number[]
  total: number
}

export function createRoute(points: Array<[number, number]>, y: number): Route {
  const pts = points.map(([x, z]) => new THREE.Vector3(x, y, z))
  const cumulative = [0]
  for (let i = 1; i < pts.length; i++) {
    cumulative.push(cumulative[i - 1] + pts[i].distanceTo(pts[i - 1]))
  }
  return { points: pts, cumulative, total: cumulative[cumulative.length - 1] }
}

/** Writes the position at `distance` along the route into `out` and returns the heading (yaw). */
export function sampleRoute(route: Route, distance: number, out: THREE.Vector3) {
  const d = THREE.MathUtils.clamp(distance, 0, route.total)
  let i = 1
  while (i < route.points.length - 1 && route.cumulative[i] < d) i++
  const a = route.points[i - 1]
  const b = route.points[i]
  const segment = route.cumulative[i] - route.cumulative[i - 1]
  const t = segment > 0 ? (d - route.cumulative[i - 1]) / segment : 0
  out.lerpVectors(a, b, t)
  return Math.atan2(b.x - a.x, b.z - a.z)
}
