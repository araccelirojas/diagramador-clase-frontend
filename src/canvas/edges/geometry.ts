import type { EdgeRouting, Position } from '@/uml/model/types'

/**
 * Pure geometry for floating edges (CLAUDE.md §9). No React, no React Flow:
 * this is the part that is worth unit testing.
 *
 * A floating edge has no fixed anchor. The attachment point is where the line
 * between the two node centres crosses the node's rectangle, so the edge
 * follows the box wherever it moves and the user can connect from any side.
 *
 * Bends change that, and each routing has to answer them differently — which is
 * what `edgeGeometry` is for: it picks the attachment points AND the path
 * together, because for an orthogonal edge the two decisions are one.
 */

export type Rect = { x: number; y: number; width: number; height: number }

/** Which way a line leaves a box: through a vertical side, or a horizontal one. */
export type Axis = 'x' | 'y'

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

/**
 * Where an ORTHOGONAL edge leaves a box: the middle of the side that faces the
 * neighbour, plus the axis it leaves along.
 *
 * The middle of a side, not the diagonal crossing point, because an orthogonal
 * run has to leave perpendicular to the border. Attaching at the diagonal point
 * and then turning is what made these edges look like they started off the
 * corner and slid along the box.
 */
export function orthogonalAttachment(rect: Rect, towards: Position): { point: Position; axis: Axis } {
  const center = centerOf(rect)
  const dx = towards.x - center.x
  const dy = towards.y - center.y

  const halfWidth = rect.width / 2
  const halfHeight = rect.height / 2

  // Compare the direction against the box's own proportions, so a wide box is
  // not left through its short side just because dx happens to be bigger.
  const horizontal = Math.abs(dx) * halfHeight >= Math.abs(dy) * halfWidth

  if (horizontal) {
    const sign = dx === 0 ? 1 : Math.sign(dx)
    return { point: { x: center.x + sign * halfWidth, y: center.y }, axis: 'x' }
  }

  const sign = dy === 0 ? 1 : Math.sign(dy)
  return { point: { x: center.x, y: center.y + sign * halfHeight }, axis: 'y' }
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

const dedupe = (points: readonly Position[]): Position[] =>
  points.filter((point, index) => index === 0 || !samePoint(point, points[index - 1]!))

/** The bend that turns one diagonal step into two axis-aligned ones. */
function elbow(from: Position, to: Position, firstMove: Axis): Position[] {
  if (from.x === to.x || from.y === to.y) return []

  return firstMove === 'x' ? [{ x: to.x, y: from.y }] : [{ x: from.x, y: to.y }]
}

/** Which way to turn first when nothing constrains it: along the longer run. */
const dominantAxis = (from: Position, to: Position): Axis =>
  Math.abs(to.x - from.x) > Math.abs(to.y - from.y) ? 'x' : 'y'

/**
 * A single orthogonal step that must LEAVE along `exit` and ARRIVE along
 * `entry`. When both ends are constrained to the same axis and are not already
 * aligned, one elbow cannot do it: the run needs a detour through the middle.
 */
function constrainedStep(from: Position, to: Position, exit: Axis, entry: Axis): Position[] {
  if (exit !== entry) {
    // Leave along `exit`, arrive along the other axis: one elbow is enough.
    return elbow(from, to, exit)
  }

  if (exit === 'x') {
    if (from.y === to.y) return []
    const middle = (from.x + to.x) / 2
    return [
      { x: middle, y: from.y },
      { x: middle, y: to.y },
    ]
  }

  if (from.x === to.x) return []
  const middle = (from.y + to.y) / 2
  return [
    { x: from.x, y: middle },
    { x: to.x, y: middle },
  ]
}

export type OrthogonalConstraints = {
  /** Axis the line must leave the source box along. */
  exit: Axis
  /** Axis the line must arrive at the target box along. */
  entry: Axis
}

/**
 * Turns a polyline into horizontal and vertical runs.
 *
 * It is a shaper, not a router: it does not try to dodge boxes — that is what
 * dragging a waypoint is for, and what elkjs will do in phase 2.
 *
 * Without constraints every step turns along its longer run, which is the right
 * guess in isolation. With them, the first and last steps obey the sides the
 * edge actually attaches to.
 */
function orthogonalThrough(
  points: readonly Position[],
  constraints?: OrthogonalConstraints,
): Position[] {
  const shaped: Position[] = []
  const lastIndex = points.length - 2

  for (let index = 0; index <= lastIndex; index += 1) {
    const from = points[index]
    const to = points[index + 1]
    if (!from || !to) continue

    shaped.push(from)

    if (!constraints) {
      shaped.push(...elbow(from, to, dominantAxis(from, to)))
      continue
    }

    const isFirst = index === 0
    const isLast = index === lastIndex

    if (isFirst && isLast) {
      shaped.push(...constrainedStep(from, to, constraints.exit, constraints.entry))
    } else if (isFirst) {
      shaped.push(...elbow(from, to, constraints.exit))
    } else if (isLast) {
      // Arriving along `entry` means the LAST move is along that axis, so the
      // elbow has to happen on the other one first.
      shaped.push(...elbow(from, to, constraints.entry === 'x' ? 'y' : 'x'))
    } else {
      shaped.push(...elbow(from, to, dominantAxis(from, to)))
    }
  }

  const last = points[points.length - 1]
  if (last) shaped.push(last)

  return dedupe(shaped)
}

/** Control point offsets for a plain two-point curve, in the edge's direction. */
function simpleCurve(from: Position, to: Position): string {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const distance = Math.hypot(dx, dy)

  if (distance === 0) return `M ${from.x},${from.y} L ${to.x},${to.y}`

  // A third of the distance bows the line noticeably without overshooting.
  const pull = Math.max(distance / 3, 30)

  // Along the dominant axis, so a vertical edge curves vertically. Pushing the
  // handles sideways on every edge is what made stacked boxes bulge outwards.
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  const c1 = horizontal
    ? { x: from.x + Math.sign(dx) * pull, y: from.y }
    : { x: from.x, y: from.y + Math.sign(dy) * pull }
  const c2 = horizontal
    ? { x: to.x - Math.sign(dx) * pull, y: to.y }
    : { x: to.x, y: to.y - Math.sign(dy) * pull }

  return `M ${from.x},${from.y} C ${c1.x},${c1.y} ${c2.x},${c2.y} ${to.x},${to.y}`
}

/**
 * A smooth curve through EVERY point, not only the two ends.
 *
 * Catmull-Rom converted to cubic Béziers: each span gets handles derived from
 * its neighbours, so the curve passes exactly through each bend the user
 * dragged instead of merely being pulled towards it. Dropping to straight
 * segments the moment a bend existed was the bug — the routing silently stopped
 * being a curve.
 */
function smoothThrough(points: readonly Position[]): string {
  const [head] = points
  if (!head) return ''
  if (points.length === 2) return simpleCurve(head, points[1]!)

  let path = `M ${head.x},${head.y}`

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index]!
    const from = points[index]!
    const to = points[index + 1]!
    const next = points[index + 2] ?? to

    // 1/6 is the standard uniform Catmull-Rom tension.
    const c1 = { x: from.x + (to.x - previous.x) / 6, y: from.y + (to.y - previous.y) / 6 }
    const c2 = { x: to.x - (next.x - from.x) / 6, y: to.y - (next.y - from.y) / 6 }

    path += ` C ${c1.x},${c1.y} ${c2.x},${c2.y} ${to.x},${to.y}`
  }

  return path
}

const polyline = (points: readonly Position[]): string => {
  const [head, ...rest] = points
  if (!head) return ''

  return `M ${head.x},${head.y} ${rest.map((point) => `L ${point.x},${point.y}`).join(' ')}`
}

/** SVG path for the edge, honouring `edge.routing` and any waypoints. */
export function pathFor(
  routing: EdgeRouting,
  from: Position,
  to: Position,
  waypoints: readonly Position[] = [],
  constraints?: OrthogonalConstraints,
): string {
  const through = dedupe([from, ...waypoints, to])

  if (routing === 'bezier') return smoothThrough(through)
  if (routing === 'orthogonal') return polyline(orthogonalThrough(through, constraints))

  return polyline(through)
}

/**
 * The points an orthogonal or straight edge actually visits, which is what the
 * association-class connector needs to meet the line where the line is.
 */
export function pointsAlong(
  routing: EdgeRouting,
  from: Position,
  to: Position,
  waypoints: readonly Position[] = [],
  constraints?: OrthogonalConstraints,
): Position[] {
  const through = dedupe([from, ...waypoints, to])

  return routing === 'orthogonal' ? orthogonalThrough(through, constraints) : through
}

/** The point halfway along a polyline, measured by length rather than by index. */
export function polylineMidpoint(points: readonly Position[]): Position {
  const [head] = points
  if (!head) return { x: 0, y: 0 }
  if (points.length === 1) return head

  const lengths: number[] = []
  let total = 0

  for (let index = 0; index < points.length - 1; index += 1) {
    const length = Math.hypot(
      points[index + 1]!.x - points[index]!.x,
      points[index + 1]!.y - points[index]!.y,
    )
    lengths.push(length)
    total += length
  }

  if (total === 0) return head

  let travelled = 0

  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index]!

    if (travelled + length >= total / 2) {
      const ratio = length === 0 ? 0 : (total / 2 - travelled) / length
      const from = points[index]!
      const to = points[index + 1]!

      return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio }
    }

    travelled += length
  }

  return points[points.length - 1]!
}

/** Cuánto se separa de la caja el bucle de una auto-asociación. */
const LOOP = 44

/**
 * El recorrido de una relación de un elemento CONSIGO MISMO.
 *
 * Los extremos flotantes no sirven aquí: la recta entre dos centros que son el mismo punto
 * no tiene dirección. Un bucle es la notación UML de siempre — sale por arriba, rodea la
 * esquina y vuelve a entrar por el lado derecho — y además deja los dos extremos separados,
 * que es lo que permite poner una multiplicidad distinta en cada uno.
 */
export function selfLoopPoints(
  rect: Rect,
  waypoints: readonly Position[] = [],
  /** Radio extra, para que dos bucles sobre la misma clase no salgan uno encima del otro. */
  crecimiento = 0,
): Position[] {
  const salida = { x: rect.x + rect.width * 0.72, y: rect.y }
  const entrada = { x: rect.x + rect.width, y: rect.y + rect.height * 0.28 }

  if (waypoints.length > 0) return dedupe([salida, ...waypoints, entrada])

  const vuelo = LOOP + crecimiento

  return dedupe([
    salida,
    { x: salida.x, y: rect.y - vuelo },
    { x: rect.x + rect.width + vuelo, y: rect.y - vuelo },
    { x: rect.x + rect.width + vuelo, y: entrada.y },
    entrada,
  ])
}

/** Cuánto se apartan entre sí dos relaciones que unen el mismo par de clases. */
export const SEPARACION_PARALELAS = 30

/**
 * Aparta una relación de las que comparten su mismo par de clases.
 *
 * Dos clases unidas por más de una relación —"Start" y "Goal" entre Aeropuerto y Vuelo, el
 * caso de manual— producen líneas que coinciden punto por punto: se leen como una sola y sus
 * multiplicidades se pisan.
 *
 * Se desplazan las DOS cajas por igual, perpendicularmente al eje que une sus centros, y la
 * geometría se calcula contra esas cajas virtuales. El resultado es la misma línea trasladada
 * de costado, con los extremos repartidos a lo ancho del borde en vez de amontonados en el
 * centro, y sin tocar las posiciones reales de los nodos.
 */
function apartar(sourceRect: Rect, targetRect: Rect, distancia: number): [Rect, Rect] {
  const a = centerOf(sourceRect)
  const b = centerOf(targetRect)
  const largo = Math.hypot(b.x - a.x, b.y - a.y)

  // Cajas superpuestas: no hay eje del que apartarse.
  if (largo < 1) return [sourceRect, targetRect]

  const nx = -(b.y - a.y) / largo
  const ny = (b.x - a.x) / largo
  const mover = (r: Rect): Rect => ({ ...r, x: r.x + nx * distancia, y: r.y + ny * distancia })

  return [mover(sourceRect), mover(targetRect)]
}

export type EdgeGeometry = {
  /** Attachment point on the source box. */
  source: Position
  /** Attachment point on the target box. */
  target: Position
  path: string
  /** Every corner the drawn line visits, ends included. */
  points: Position[]
  /** Halfway along the line, for labels and for the association-class connector. */
  middle: Position
}

/**
 * Everything the edge component needs, in one call.
 *
 * Endpoints and path are decided together because for an orthogonal edge they
 * are the same decision: the side a line leaves from dictates the direction of
 * its first run, and picking them apart is what let the two disagree.
 */
export function edgeGeometry(
  routing: EdgeRouting,
  sourceRect: Rect,
  targetRect: Rect,
  waypoints: readonly Position[] = [],
  /** Los dos extremos son el mismo nodo: se dibuja como bucle. */
  esBucle = false,
  /**
   * Cuánto apartar esta línea de las paralelas que unen el mismo par de clases. En un bucle
   * se lee como radio extra y nunca es negativo; en el resto, como desplazamiento lateral
   * con signo respecto del eje entre los dos centros.
   */
  separacion = 0,
): EdgeGeometry {
  if (esBucle) {
    const points = selfLoopPoints(sourceRect, waypoints, separacion)
    const [primero] = points
    const ultimo = points[points.length - 1]!

    return {
      source: primero!,
      target: ultimo,
      // La curva pasa por los mismos puntos; el bucle ya es su propia forma.
      path: routing === 'bezier' ? smoothThrough(points) : polyline(points),
      points,
      middle: polylineMidpoint(points),
    }
  }

  // Contra las cajas apartadas, no contra las reales: es lo que separa las paralelas.
  const [origen, destino] =
    separacion === 0 ? [sourceRect, targetRect] : apartar(sourceRect, targetRect, separacion)

  if (routing !== 'orthogonal') {
    const ends = floatingEndpoints(origen, destino, waypoints)
    const points = pointsAlong(routing, ends.source, ends.target, waypoints)

    return {
      source: ends.source,
      target: ends.target,
      path: pathFor(routing, ends.source, ends.target, waypoints),
      points,
      middle: polylineMidpoint(points),
    }
  }

  const towardsSource = waypoints[0] ?? centerOf(destino)
  const towardsTarget = waypoints[waypoints.length - 1] ?? centerOf(origen)

  const from = orthogonalAttachment(origen, towardsSource)
  const to = orthogonalAttachment(destino, towardsTarget)
  const constraints: OrthogonalConstraints = { exit: from.axis, entry: to.axis }

  const points = pointsAlong(routing, from.point, to.point, waypoints, constraints)

  return {
    source: from.point,
    target: to.point,
    path: pathFor(routing, from.point, to.point, waypoints, constraints),
    points,
    middle: polylineMidpoint(points),
  }
}
