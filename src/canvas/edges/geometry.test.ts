import { describe, expect, it } from 'vitest'

import {
  centerOf,
  floatingEndpoints,
  intersectRect,
  labelAnchor,
  pathFor,
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
