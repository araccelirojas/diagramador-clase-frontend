import { midpoint } from '@/canvas/edges/geometry'
import type { useWaypointDrag } from '@/canvas/edges/useWaypointDrag'
import type { Position } from '@/uml/model/types'

type WaypointHandlesProps = {
  /** Attachment point on the source box. */
  from: Position
  /** Attachment point on the target box. */
  to: Position
  drag: ReturnType<typeof useWaypointDrag>
}

const AT = (point: Position): string =>
  `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)`

const HANDLE =
  'nodrag nopan pointer-events-auto absolute h-2.5 w-2.5 cursor-move rounded-xs border border-sky-600 bg-white'

const GHOST =
  'nodrag nopan pointer-events-auto absolute h-2 w-2 cursor-move rounded-full border border-sky-500 bg-white opacity-40 transition-opacity hover:opacity-100'

/**
 * The bend points of a selected edge: a solid square on each existing waypoint,
 * and a faint dot in the middle of every segment that creates a new one when
 * dragged. Double clicking a square removes it.
 */
export function WaypointHandles({ from, to, drag }: WaypointHandlesProps) {
  const { waypoints, beginDrag, onPointerMove, endDrag, removeAt } = drag
  const points = [from, ...waypoints, to]

  return (
    <>
      {waypoints.map((point, index) => (
        <div
          key={`w-${index}`}
          className={HANDLE}
          style={{ transform: AT(point) }}
          onPointerDown={beginDrag([...waypoints], index)}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onDoubleClick={(event) => {
            event.stopPropagation()
            removeAt(index)
          }}
          title="Arrastrá para mover · doble clic para quitar"
        />
      ))}

      {points.slice(0, -1).map((point, index) => {
        const next = points[index + 1]
        if (!next) return null

        const center = midpoint(point, next)
        // Dragging a ghost inserts a real waypoint at this position in the list.
        const inserted = [...waypoints.slice(0, index), center, ...waypoints.slice(index)]

        return (
          <div
            key={`g-${index}`}
            className={GHOST}
            style={{ transform: AT(center) }}
            onPointerDown={beginDrag(inserted, index)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            title="Arrastrá para doblar la línea acá"
          />
        )
      })}
    </>
  )
}
