import { MARKERS } from '@/canvas/markers/markerIds'

/**
 * Every UML arrow head, declared once (CLAUDE.md §7.3).
 *
 * Four details that are not negotiable, because each one costs an afternoon to
 * discover:
 *
 * - `markerUnits="userSpaceOnUse"`, otherwise the heads scale with the stroke
 *   width and a selected edge grows a giant triangle.
 * - `refX` placed so the TIP touches the node border, not the centre of the
 *   marker box.
 * - The diamond goes on `marker-start` with `orient="auto"`: the path runs from
 *   source to target, so the diamond is drawn "forwards" from the whole's end.
 * - Hollow shapes are filled with the canvas colour, never `none`: with `none`
 *   the line shows through the inside of the figure.
 */

const STROKE = '#334155'
/** Same as the canvas background (bg-slate-50). */
const CANVAS_FILL = '#f8fafc'

export function UmlMarkers() {
  return (
    <svg className="pointer-events-none absolute h-0 w-0" aria-hidden>
      <defs>
        {/* Open arrow: dependency and directed association. Two strokes, no fill. */}
        <marker
          id={MARKERS.arrowOpen}
          markerUnits="userSpaceOnUse"
          markerWidth={12}
          markerHeight={12}
          refX={11}
          refY={6}
          orient="auto"
        >
          <path
            d="M 1 1 L 11 6 L 1 11"
            fill="none"
            stroke={STROKE}
            strokeWidth={1.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>

        {/* Hollow triangle: generalization and realization. */}
        <marker
          id={MARKERS.triangleHollow}
          markerUnits="userSpaceOnUse"
          markerWidth={14}
          markerHeight={14}
          refX={13}
          refY={7}
          orient="auto"
        >
          <path d="M 1 1 L 13 7 L 1 13 z" fill={CANVAS_FILL} stroke={STROKE} strokeWidth={1.2} />
        </marker>

        {/* Hollow diamond: aggregation. Sits on marker-start, tip at the border. */}
        <marker
          id={MARKERS.diamondHollow}
          markerUnits="userSpaceOnUse"
          markerWidth={18}
          markerHeight={12}
          refX={1}
          refY={6}
          orient="auto"
        >
          <path
            d="M 1 6 L 8 1.5 L 16 6 L 8 10.5 z"
            fill={CANVAS_FILL}
            stroke={STROKE}
            strokeWidth={1.2}
          />
        </marker>

        {/* Filled diamond: composition. */}
        <marker
          id={MARKERS.diamondFilled}
          markerUnits="userSpaceOnUse"
          markerWidth={18}
          markerHeight={12}
          refX={1}
          refY={6}
          orient="auto"
        >
          <path d="M 1 6 L 8 1.5 L 16 6 L 8 10.5 z" fill={STROKE} stroke={STROKE} strokeWidth={1.2} />
        </marker>

        <marker
          id={MARKERS.circleFilled}
          markerUnits="userSpaceOnUse"
          markerWidth={10}
          markerHeight={10}
          refX={5}
          refY={5}
          orient="auto"
        >
          <circle cx={5} cy={5} r={3.5} fill={STROKE} />
        </marker>
      </defs>
    </svg>
  )
}
