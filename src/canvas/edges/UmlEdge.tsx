import { BaseEdge, EdgeLabelRenderer, useInternalNode, type EdgeProps } from '@xyflow/react'

import { edgeGeometry, labelAnchor, type Rect } from '@/canvas/edges/geometry'
import { useWaypointDrag } from '@/canvas/edges/useWaypointDrag'
import { WaypointHandles } from '@/canvas/edges/WaypointHandles'
import { markerUrl } from '@/canvas/markers/markerIds'
import type { UmlFlowEdge } from '@/state/selectors'
import type { AssociationEnd, UmlEdge as UmlEdgeModel } from '@/uml/model/types'
import { getRelation, type RelationSpec } from '@/uml/registry'

/**
 * THE edge component. Line style, arrow heads and which labels to show all come
 * from the RelationSpec, so the six relations of phase 1 — and every one added
 * later — are this same component (CLAUDE.md §7.2).
 */

const STROKE = '#334155'
const STROKE_SELECTED = '#0284c7'

const LABEL_ALONG = 26
const LABEL_SIDE = 11

const LABEL_CLASS =
  'pointer-events-none absolute rounded-xs bg-slate-50/90 px-1 text-[10px] leading-tight text-slate-600'

type InternalNode = ReturnType<typeof useInternalNode>

function rectOf(node: NonNullable<InternalNode>): Rect {
  return {
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    width: node.measured.width ?? 0,
    height: node.measured.height ?? 0,
  }
}

/** "0..* rol" — whatever the spec says this relation supports. */
function endLabel(end: AssociationEnd, spec: RelationSpec): string | null {
  const parts: string[] = []

  if (spec.supports.multiplicity && end.multiplicity) parts.push(end.multiplicity)
  if (spec.supports.roles && end.role) {
    parts.push(end.visibility ? `${end.visibility} ${end.role}` : end.role)
  }

  return parts.length > 0 ? parts.join(' ') : null
}

/** The association name plus its reading-direction triangle. */
function nameLabel(edge: UmlEdgeModel, spec: RelationSpec): string | null {
  if (!spec.supports.name || !edge.name) return null

  if (edge.nameDirection === 'sourceToTarget') return `${edge.name} ▸`
  if (edge.nameDirection === 'targetToSource') return `◂ ${edge.name}`

  return edge.name
}

type EdgeBodyProps = {
  id: string
  edge: UmlEdgeModel
  sourceRect: Rect
  targetRect: Rect
  separacion: number
  isSelected: boolean
}

function EdgeBody({ id, edge, sourceRect, targetRect, separacion, isSelected }: EdgeBodyProps) {
  const spec = getRelation(edge.kind)
  const drag = useWaypointDrag(edge)

  // Endpoints and path in one call: for an orthogonal edge the side it leaves
  // from and the direction of its first run are the same decision.
  // Una auto-asociación: los dos extremos son el mismo nodo y se dibuja como bucle.
  const esBucle = edge.source === edge.target
  // Con waypoints no se aparta: si la moviste a mano, está donde vos la pusiste.
  const geometry = edgeGeometry(
    edge.routing,
    sourceRect,
    targetRect,
    drag.waypoints,
    esBucle,
    drag.waypoints.length > 0 ? 0 : separacion,
  )
  const points = { source: geometry.source, target: geometry.target }
  const path = geometry.path

  const sourceText = endLabel(edge.ends.source, spec)
  const targetText = endLabel(edge.ends.target, spec)
  const name = nameLabel(edge, spec)

  // La etiqueta se orienta por el TRAMO que sale del extremo, no por el extremo contrario.
  // En un bucle los dos extremos pertenecen a la misma caja, así que apuntar al otro
  // empujaba la multiplicidad hacia adentro del nodo, que es donde quedaba tapada. De paso,
  // en un ruteo ortogonal la etiqueta sigue ahora el primer tramo real en vez de la
  // diagonal hacia un extremo por el que la línea no pasa.
  const vecinoDelOrigen = geometry.points[1] ?? points.target
  const vecinoDelDestino = geometry.points[geometry.points.length - 2] ?? points.source

  const sourceAnchor = labelAnchor(points.source, vecinoDelOrigen, LABEL_ALONG, -LABEL_SIDE)
  const targetAnchor = labelAnchor(points.target, vecinoDelDestino, LABEL_ALONG, LABEL_SIDE)
  // Halfway ALONG the drawn line, so the name follows the bends instead of
  // floating at the midpoint of a chord the line never touches.
  const nameAnchor = geometry.middle

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerStart={markerUrl(spec.sourceMarker)}
        markerEnd={markerUrl(spec.targetMarker)}
        interactionWidth={24}
        style={{
          stroke: isSelected ? STROKE_SELECTED : STROKE,
          strokeWidth: isSelected ? 2 : 1.2,
          ...(spec.line === 'dashed' ? { strokeDasharray: '6 4' } : {}),
        }}
      />

      <EdgeLabelRenderer>
        {sourceText ? (
          <div className={LABEL_CLASS} style={{ transform: at(sourceAnchor) }}>
            {sourceText}
          </div>
        ) : null}

        {targetText ? (
          <div className={LABEL_CLASS} style={{ transform: at(targetAnchor) }}>
            {targetText}
          </div>
        ) : null}

        {name ? (
          <div
            className={`${LABEL_CLASS} font-medium text-slate-700`}
            style={{ transform: at(nameAnchor) }}
          >
            {name}
          </div>
        ) : null}

        {isSelected ? (
          <WaypointHandles from={points.source} to={points.target} drag={drag} />
        ) : null}
      </EdgeLabelRenderer>
    </>
  )
}

const at = (point: { x: number; y: number }): string =>
  `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)`

export function UmlEdge({ id, source, target, data, selected }: EdgeProps<UmlFlowEdge>) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)

  // Not measured yet on the first frame, or an endpoint just disappeared.
  if (!sourceNode || !targetNode || !data) return null

  return (
    <EdgeBody
      id={id}
      edge={data.edge}
      sourceRect={rectOf(sourceNode)}
      targetRect={rectOf(targetNode)}
      separacion={data.separacion}
      isSelected={selected === true}
    />
  )
}
