import { useReactFlow } from '@xyflow/react'
import { useCallback, useState, type PointerEvent } from 'react'

import { setEdgeWaypoints } from '@/state/commands'
import { useDiagramStore } from '@/state/useDiagramStore'
import type { Position, UmlEdge } from '@/uml/model/types'

/**
 * Dragging the bend points of an edge, draw.io style.
 *
 * Same rule as dragging a node (§6.3): while the pointer is down the points
 * live in ephemeral local state, and only the release dispatches a command. A
 * whole drag is therefore one undo step, and the document never sees the
 * intermediate positions.
 */

const GRID = 8

const snap = (value: number): number => Math.round(value / GRID) * GRID

export function useWaypointDrag(edge: UmlEdge) {
  const { screenToFlowPosition } = useReactFlow()
  const dispatch = useDiagramStore((state) => state.dispatch)
  const [drag, setDrag] = useState<{ index: number; points: Position[] } | null>(null)

  const waypoints = drag?.points ?? edge.waypoints

  /** Starts moving `points[index]`; `points` may already include a new one. */
  const beginDrag = useCallback(
    (points: Position[], index: number) => (event: PointerEvent<Element>) => {
      event.stopPropagation()
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      setDrag({ index, points })
    },
    [],
  )

  const onPointerMove = useCallback(
    (event: PointerEvent<Element>) => {
      if (!drag) return

      const flow = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const moved = { x: snap(flow.x), y: snap(flow.y) }

      setDrag({
        index: drag.index,
        points: drag.points.map((point, index) => (index === drag.index ? moved : point)),
      })
    },
    [drag, screenToFlowPosition],
  )

  const endDrag = useCallback(
    (event: PointerEvent<Element>) => {
      if (!drag) return

      event.currentTarget.releasePointerCapture(event.pointerId)
      dispatch(setEdgeWaypoints({ id: edge.id, waypoints: drag.points }))
      setDrag(null)
    },
    [dispatch, drag, edge.id],
  )

  /** Double clicking a bend point straightens the line again. */
  const removeAt = useCallback(
    (index: number) => {
      dispatch(
        setEdgeWaypoints({
          id: edge.id,
          waypoints: edge.waypoints.filter((_, position) => position !== index),
        }),
      )
    },
    [dispatch, edge.id, edge.waypoints],
  )

  return { waypoints, beginDrag, onPointerMove, endDrag, removeAt }
}
