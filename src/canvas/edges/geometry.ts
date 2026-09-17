import type { EdgeRouting, Position } from '@/uml/model/types'

/**
 * Pure geometry for floating edges (CLAUDE.md §9). No React, no React Flow:
 * this is the part that is worth unit testing.
 *
 * A floating edge has no fixed anchor. The attachment point is where the line
 * between the two node centres crosses the node's rectangle, so the edge
 * follows the box wherever it moves and the user can connect from any side.
 */

export type Rect = { x: number; y: number; width: number; height: number }

export const centerOf = (rect: Rect): Position => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
})

/**
 * Point where the segment from the centre of `rect` towards `towards` crosses
 * the rectangle border. Works on all four sides and exactly on the corners.
 */
export function intersectRect(rect: Rect, towards: Position): Position {
  const center = centerOf(rect)
  const dx = towards.x - center.x
  const dy = towards.y - center.y

  // Degenerate: the other point is the centre itself.
  if (dx === 0 && dy === 0) return center

  const halfWidth = rect.width / 2
  const halfHeight = rect.height / 2

  // How far along the direction we can go before leaving each slab.
  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx)
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy)
  const scale = Math.min(scaleX, scaleY)

  return { x: center.x + dx * scale, y: center.y + dy * scale }
}

/**
 * Both attachment points of an edge between two boxes.
 *
 * With waypoints, each end aims at the nearest one instead of at the other
 * box's centre: otherwise the line leaves the box on one side and immediately
 * doubles back towards the point the user dragged.
 */
export function floatingEndpoints(
  source: Rect,
  target: Rect,
  waypoints: readonly Position[] = [],
): { source: Position; target: Position } {
  const first = waypoints[0] ?? centerOf(target)
  const last = waypoints[waypoints.length - 1] ?? centerOf(source)

  return {
    source: intersectRect(source, first),
    target: intersectRect(target, last),
  }
}

/** Angle of the segment, in radians, used to place the end labels. */
export const angleOf = (from: Position, to: Position): number =>
  Math.atan2(to.y - from.y, to.x - from.x)

/**
 * Point offset from an endpoint along the edge, where multiplicity and role
 * labels go: a bit inside the line and pushed to one side of it.
 */
export function labelAnchor(
  endpoint: Position,
  towards: Position,
  alongOffset: number,
  sideOffset: number,
): Position {
  const angle = angleOf(endpoint, towards)

  return {
    x: endpoint.x + Math.cos(angle) * alongOffset - Math.sin(angle) * sideOffset,
    y: endpoint.y + Math.sin(angle) * alongOffset + Math.cos(angle) * sideOffset,
  }
}

export const midpoint = (a: Position, b: Position): Position => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
})

const samePoint = (a: Position, b: Position): boolean => a.x === b.x && a.y === b.y

/**
 * Turns a polyline into horizontal and vertical runs, adding one elbow between
 * each pair of consecutive points. It is a shaper, not a router: it does not
 * try to dodge boxes — that is what dragging a waypoint is for, and what elkjs
 * will do in phase 2.
 */
function orthogonalThrough(points: readonly Position[]): Position[] {
  const shaped: Position[] = []

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]
    const to = points[index + 1]
    if (!from || !to) continue

    shaped.push(from)

    if (from.x !== to.x && from.y !== to.y) {
      const horizontalFirst = Math.abs(to.x - from.x) > Math.abs(to.y - from.y)
      shaped.push(horizontalFirst ? { x: to.x, y: from.y } : { x: from.x, y: to.y })
    }
  }

  const last = points[points.length - 1]
  if (last) shaped.push(last)

  return shaped.filter((point, index) => index === 0 || !samePoint(point, shaped[index - 1]!))
}

/** SVG path for the edge, honouring `edge.routing` and any waypoints. */
export function pathFor(routing: EdgeRouting, from: Position, to: Position, waypoints: Position[] = []): string {
  if (routing === 'bezier' && waypoints.length === 0) {
    const delta = Math.max(Math.abs(to.x - from.x) / 2, 30)
    return `M ${from.x},${from.y} C ${from.x + delta},${from.y} ${to.x - delta},${to.y} ${to.x},${to.y}`
  }

  const through = [from, ...waypoints, to]
  const points = routing === 'orthogonal' ? orthogonalThrough(through) : through

  const [head, ...rest] = points
  if (!head) return ''

  return `M ${head.x},${head.y} ${rest.map((point) => `L ${point.x},${point.y}`).join(' ')}`
}
