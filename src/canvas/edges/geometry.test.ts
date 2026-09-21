import { describe, expect, it } from 'vitest'

import {
  centerOf,
  edgeGeometry,
  selfLoopPoints,
  floatingEndpoints,
  intersectRect,
  labelAnchor,
  orthogonalAttachment,
  pathFor,
  polylineMidpoint,
  type Rect,
} from '@/canvas/edges/geometry'

/** A 100x60 box centred on the origin. */
const box: Rect = { x: -50, y: -30, width: 100, height: 60 }

describe('intersectRect', () => {
  it('crosses the right side', () => {
    expect(intersectRect(box, { x: 1000, y: 0 })).toEqual({ x: 50, y: 0 })
  })

  it('crosses the left side', () => {
    expect(intersectRect(box, { x: -1000, y: 0 })).toEqual({ x: -50, y: 0 })
  })

  it('crosses the top side', () => {
    expect(intersectRect(box, { x: 0, y: -1000 })).toEqual({ x: 0, y: -30 })
  })

  it('crosses the bottom side', () => {
    expect(intersectRect(box, { x: 0, y: 1000 })).toEqual({ x: 0, y: 30 })
  })

  it('lands exactly on the corner when the direction is diagonal', () => {
    // The box is 100x60, so the corner direction is (50, 30).
    expect(intersectRect(box, { x: 500, y: 300 })).toEqual({ x: 50, y: 30 })
  })

  it('stays on the border even when the other point is inside', () => {
    const point = intersectRect(box, { x: 10, y: 0 })

    expect(point).toEqual({ x: 50, y: 0 })
  })

  it('returns the centre when there is no direction at all', () => {
    expect(intersectRect(box, centerOf(box))).toEqual({ x: 0, y: 0 })
  })

  it('works on a box that is not centred on the origin', () => {
    const offset: Rect = { x: 100, y: 100, width: 40, height: 40 }

    expect(intersectRect(offset, { x: 1000, y: 120 })).toEqual({ x: 140, y: 120 })
  })
})

describe('floatingEndpoints', () => {
  it('attaches to the facing sides of two boxes', () => {
    const left: Rect = { x: 0, y: 0, width: 100, height: 60 }
    const right: Rect = { x: 300, y: 0, width: 100, height: 60 }

    expect(floatingEndpoints(left, right)).toEqual({
      source: { x: 100, y: 30 },
      target: { x: 300, y: 30 },
    })
  })

  it('does not blow up when the boxes overlap', () => {
    const a: Rect = { x: 0, y: 0, width: 100, height: 60 }
    const b: Rect = { x: 20, y: 10, width: 100, height: 60 }
    const { source, target } = floatingEndpoints(a, b)

    expect(Number.isFinite(source.x) && Number.isFinite(source.y)).toBe(true)
    expect(Number.isFinite(target.x) && Number.isFinite(target.y)).toBe(true)
  })

  it('handles a box fully contained in another', () => {
    const outer: Rect = { x: 0, y: 0, width: 400, height: 400 }
    const inner: Rect = { x: 150, y: 150, width: 100, height: 100 }
    const { source, target } = floatingEndpoints(outer, inner)

    expect(Number.isFinite(source.x)).toBe(true)
    expect(Number.isFinite(target.x)).toBe(true)
  })
})

describe('floatingEndpoints with waypoints', () => {
  const left: Rect = { x: 0, y: 0, width: 100, height: 60 }
  const right: Rect = { x: 300, y: 0, width: 100, height: 60 }

  it('aims each end at the nearest bend instead of the other box', () => {
    // A bend straight above: the line must leave through the TOP of the box,
    // not through the facing side and then double back.
    const { source } = floatingEndpoints(left, right, [{ x: 50, y: -200 }])

    expect(source).toEqual({ x: 50, y: 0 })
  })

  it('uses the last bend for the target end', () => {
    const { target } = floatingEndpoints(left, right, [{ x: 350, y: 300 }])

    expect(target).toEqual({ x: 350, y: 60 })
  })

  it('falls back to the other centre when there are no bends', () => {
    expect(floatingEndpoints(left, right, [])).toEqual(floatingEndpoints(left, right))
  })
})

describe('orthogonal routing through bends', () => {
  it('keeps every run horizontal or vertical', () => {
    const path = pathFor('orthogonal', { x: 0, y: 0 }, { x: 200, y: 200 }, [{ x: 100, y: 50 }])
    const points = [...path.matchAll(/[ML] (-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((match) => ({
      x: Number(match[1]),
      y: Number(match[2]),
    }))

    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1]!
      const to = points[index]!

      expect(from.x === to.x || from.y === to.y, `${JSON.stringify(from)} -> ${JSON.stringify(to)}`).toBe(true)
    }
  })

  it('passes through the bend the user dragged', () => {
    expect(pathFor('orthogonal', { x: 0, y: 0 }, { x: 200, y: 200 }, [{ x: 100, y: 50 }])).toContain(
      '100,50',
    )
  })

  it('drops the elbow when two points already line up', () => {
    expect(pathFor('orthogonal', { x: 0, y: 0 }, { x: 0, y: 100 })).toBe('M 0,0 L 0,100')
  })
})

describe('labelAnchor', () => {
  it('offsets along the edge and to one side of it', () => {
    // Edge pointing right: "along" moves +x, positive side offset moves +y.
    const anchor = labelAnchor({ x: 0, y: 0 }, { x: 100, y: 0 }, 20, 8)

    expect(anchor.x).toBeCloseTo(20)
    expect(anchor.y).toBeCloseTo(8)
  })

  it('follows the direction of the edge', () => {
    const anchor = labelAnchor({ x: 0, y: 0 }, { x: 0, y: 100 }, 10, 0)

    expect(anchor.x).toBeCloseTo(0)
    expect(anchor.y).toBeCloseTo(10)
  })
})

describe('pathFor', () => {
  it('draws a straight segment', () => {
    expect(pathFor('straight', { x: 0, y: 0 }, { x: 10, y: 10 })).toBe('M 0,0 L 10,10')
  })

  it('draws one elbow on the dominant axis', () => {
    expect(pathFor('orthogonal', { x: 0, y: 0 }, { x: 100, y: 20 })).toBe('M 0,0 L 100,0 L 100,20')
    expect(pathFor('orthogonal', { x: 0, y: 0 }, { x: 20, y: 100 })).toBe('M 0,0 L 0,100 L 20,100')
  })

  it('goes through the waypoints when there are any', () => {
    expect(pathFor('straight', { x: 0, y: 0 }, { x: 10, y: 0 }, [{ x: 5, y: 5 }])).toBe(
      'M 0,0 L 5,5 L 10,0',
    )
  })

  it('produces a curve for bezier routing', () => {
    expect(pathFor('bezier', { x: 0, y: 0 }, { x: 100, y: 0 })).toContain('C')
  })
})

/** Reads every anchor point back out of a path string, curves included. */
function pointsIn(path: string): { x: number; y: number }[] {
  return [...path.matchAll(/[ML] (-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
  }))
}

const A: Rect = { x: 0, y: 0, width: 100, height: 60 }

describe('bezier routing', () => {
  it('stays a curve after the user drags a bend', () => {
    // The bug: any waypoint dropped the edge to straight segments, so the
    // routing silently stopped being a curve.
    const path = pathFor('bezier', { x: 0, y: 0 }, { x: 200, y: 0 }, [{ x: 100, y: 80 }])

    expect(path).toContain('C')
    expect(path).not.toContain('L')
  })

  it('passes exactly through every bend, not merely near them', () => {
    const path = pathFor('bezier', { x: 0, y: 0 }, { x: 200, y: 0 }, [{ x: 100, y: 80 }])

    expect(path).toContain('100,80')
  })

  it('curves along the edge direction, so a vertical edge bows vertically', () => {
    // The old control points were always horizontal, which made two stacked
    // boxes bulge sideways instead of joining smoothly.
    const vertical = pathFor('bezier', { x: 0, y: 0 }, { x: 0, y: 200 })
    const controls = pointsIn(vertical.replace('M', 'L'))

    expect(vertical).toContain('C')
    // Every control point shares the x of the straight vertical line.
    for (const point of controls) expect(point.x).toBe(0)
  })

  it('does not blow up when both ends coincide', () => {
    expect(() => pathFor('bezier', { x: 5, y: 5 }, { x: 5, y: 5 })).not.toThrow()
  })
})

describe('orthogonal attachment', () => {
  it('leaves through the middle of the side that faces the neighbour', () => {
    expect(orthogonalAttachment(A, { x: 500, y: 30 })).toEqual({
      point: { x: 100, y: 30 },
      axis: 'x',
    })
    expect(orthogonalAttachment(A, { x: 50, y: 500 })).toEqual({
      point: { x: 50, y: 60 },
      axis: 'y',
    })
  })

  it('weighs the direction against the shape of the box', () => {
    // A wide, short box reached from slightly above must be left through the
    // top, not through a side just because dx happens to be larger.
    const wide: Rect = { x: 0, y: 0, width: 400, height: 40 }

    expect(orthogonalAttachment(wide, { x: 260, y: -200 }).axis).toBe('y')
  })
})

describe('orthogonal routing between real boxes', () => {
  const left: Rect = { x: 0, y: 0, width: 100, height: 60 }
  const right: Rect = { x: 300, y: 200, width: 100, height: 60 }

  it('keeps every run axis aligned, bends included', () => {
    const geometry = edgeGeometry('orthogonal', left, right, [{ x: 200, y: 120 }])

    for (let index = 1; index < geometry.points.length; index += 1) {
      const from = geometry.points[index - 1]!
      const to = geometry.points[index]!

      expect(
        from.x === to.x || from.y === to.y,
        `${JSON.stringify(from)} -> ${JSON.stringify(to)}`,
      ).toBe(true)
    }
  })

  it('leaves and arrives perpendicular to the side it attaches to', () => {
    const geometry = edgeGeometry('orthogonal', left, right)
    const [first, second] = geometry.points
    const last = geometry.points[geometry.points.length - 1]!
    const beforeLast = geometry.points[geometry.points.length - 2]!

    // Attached on a vertical side => the first run is horizontal, and likewise
    // for the arrival. Attaching diagonally and then turning was what made the
    // line look like it started off the corner.
    const exitAxis = first!.x === second!.x ? 'y' : 'x'
    const entryAxis = beforeLast.x === last.x ? 'y' : 'x'

    expect(exitAxis).toBe(geometry.source.x === 100 || geometry.source.x === 0 ? 'x' : 'y')
    expect(entryAxis).toBe(geometry.target.x === 300 || geometry.target.x === 400 ? 'x' : 'y')
  })

  it('detours through the middle when both ends face the same way', () => {
    // Side by side but not aligned: one elbow cannot leave and arrive
    // horizontally, so the run needs two.
    const path = pathFor(
      'orthogonal',
      { x: 100, y: 30 },
      { x: 300, y: 230 },
      [],
      { exit: 'x', entry: 'x' },
    )

    expect(pointsIn(path)).toEqual([
      { x: 100, y: 30 },
      { x: 200, y: 30 },
      { x: 200, y: 230 },
      { x: 300, y: 230 },
    ])
  })

  it('still passes through the bend the user dragged', () => {
    const geometry = edgeGeometry('orthogonal', left, right, [{ x: 200, y: 120 }])

    expect(geometry.path).toContain('200,120')
  })
})

describe('straight routing is left alone', () => {
  it('is still a plain polyline through the bends', () => {
    const geometry = edgeGeometry('straight', A, { x: 300, y: 0, width: 100, height: 60 }, [
      { x: 200, y: 100 },
    ])

    expect(geometry.path).toContain('L 200,100')
    expect(geometry.path).not.toContain('C')
  })
})

describe('polylineMidpoint', () => {
  it('measures by length, not by index', () => {
    // Two segments, the first much longer: the middle falls inside it.
    const middle = polylineMidpoint([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 110, y: 0 }])

    expect(middle.x).toBeCloseTo(55)
    expect(middle.y).toBeCloseTo(0)
  })

  it('survives a degenerate line', () => {
    expect(polylineMidpoint([{ x: 7, y: 7 }, { x: 7, y: 7 }])).toEqual({ x: 7, y: 7 })
    expect(polylineMidpoint([])).toEqual({ x: 0, y: 0 })
  })
})

describe('auto-asociación: la relación de un elemento consigo mismo', () => {
  const caja: Rect = { x: 100, y: 100, width: 200, height: 80 }

  it('sale y entra por puntos distintos de la misma caja', () => {
    const geometria = edgeGeometry('straight', caja, caja, [], true)

    // Si coincidieran, no habría dónde poner una multiplicidad en cada extremo.
    expect(geometria.source).not.toEqual(geometria.target)
  })

  it('sus multiplicidades caen fuera de la caja, no tapadas por ella', () => {
    // Los mismos desplazamientos que usa UmlEdge para colocar las etiquetas.
    const ALONG = 26
    const SIDE = 11

    const { source, target, points } = edgeGeometry('straight', caja, caja, [], true)

    // La orientación la da el tramo que sale del extremo. Apuntando al extremo contrario
    // —que en un bucle está al otro lado de la MISMA caja— la etiqueta caía adentro.
    const origen = labelAnchor(source, points[1]!, ALONG, -SIDE)
    const destino = labelAnchor(target, points[points.length - 2]!, ALONG, SIDE)

    const dentro = (p: { x: number; y: number }) =>
      p.x > caja.x && p.x < caja.x + caja.width && p.y > caja.y && p.y < caja.y + caja.height

    expect(dentro(origen)).toBe(false)
    expect(dentro(destino)).toBe(false)
  })

  it('los dos extremos tocan el borde de la caja', () => {
    const { source, target } = edgeGeometry('straight', caja, caja, [], true)

    const enElBorde = (p: { x: number; y: number }) =>
      p.x === caja.x ||
      p.x === caja.x + caja.width ||
      p.y === caja.y ||
      p.y === caja.y + caja.height

    expect(enElBorde(source)).toBe(true)
    expect(enElBorde(target)).toBe(true)
  })

  it('el bucle sale de la caja en vez de quedarse dentro', () => {
    const puntos = selfLoopPoints(caja)

    // Al menos un punto por fuera: si no, la línea quedaría tapada por el nodo.
    expect(puntos.some((p) => p.y < caja.y || p.x > caja.x + caja.width)).toBe(true)
  })

  it('no degenera a un punto, que es lo que pasaba sin tratarlo aparte', () => {
    const { path, points } = edgeGeometry('straight', caja, caja, [], true)

    expect(points.length).toBeGreaterThan(2)
    expect(path).toContain('L')
  })

  it('pasa por el punto que el usuario arrastró', () => {
    const geometria = edgeGeometry('straight', caja, caja, [{ x: 400, y: 40 }], true)

    expect(geometria.path).toContain('400,40')
  })

  it('sigue siendo una curva con ruteo bezier', () => {
    const geometria = edgeGeometry('bezier', caja, caja, [], true)

    expect(geometria.path).toContain('C')
  })

  it('su punto medio cae sobre el bucle, no dentro de la caja', () => {
    const { middle } = edgeGeometry('straight', caja, caja, [], true)

    // Es donde se ancla el conector de una clase de asociación.
    const dentro =
      middle.x > caja.x &&
      middle.x < caja.x + caja.width &&
      middle.y > caja.y &&
      middle.y < caja.y + caja.height

    expect(dentro).toBe(false)
  })
})
