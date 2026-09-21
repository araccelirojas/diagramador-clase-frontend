import { useInternalNode, useStore, ViewportPortal } from '@xyflow/react'

import { centerOf, edgeGeometry, intersectRect, type Rect } from '@/canvas/edges/geometry'
import { useDiagramStore } from '@/state/useDiagramStore'
import type { UmlNode } from '@/uml/model/types'

/**
 * The dashed connector joining an association class to its relation.
 *
 * It is NOT a React Flow edge: React Flow connects node to node, and this joins
 * a node to the middle of an edge. So it is drawn in its own SVG layer inside
 * `<ViewportPortal>`, which places children in flow coordinates and lets the
 * viewport pan and zoom it along with everything else.
 *
 * Purely derived from the document plus the measured boxes — it holds no state
 * and nothing can select or drag it. Moving either box moves the line.
 */

const STROKE = '#64748b'

function rectFrom(
  position: { x: number; y: number },
  measured: { width?: number; height?: number } | undefined,
): Rect {
  return {
    x: position.x,
    y: position.y,
    width: measured?.width ?? 0,
    height: measured?.height ?? 0,
  }
}

function Link({ node }: { node: UmlNode }) {
  const association = useDiagramStore((state) =>
    node.associationId === null ? undefined : state.doc.edges[node.associationId],
  )

  const classNode = useInternalNode(node.id)
  const sourceNode = useInternalNode(association?.source ?? '')
  const targetNode = useInternalNode(association?.target ?? '')

  if (!association || !classNode || !sourceNode || !targetNode) return null

  const classRect = rectFrom(classNode.internals.positionAbsolute, classNode.measured)
  const sourceRect = rectFrom(sourceNode.internals.positionAbsolute, sourceNode.measured)
  const targetRect = rectFrom(targetNode.internals.positionAbsolute, targetNode.measured)

  if (classRect.width === 0 || sourceRect.width === 0 || targetRect.width === 0) return null

  // The same geometry UmlEdge draws, so the connector meets the line where the
  // line actually is — halfway ALONG it, bends and routing included, not at the
  // midpoint of a chord an orthogonal or curved edge never passes through.
  //
  // `esBucle` incluido: en una auto-asociación los dos extremos son la misma caja, y sin
  // esta bandera la geometría cae en la rama de dos nodos distintos, cuyo punto medio es
  // el centro del propio nodo. El conector apuntaba entonces a la clase en vez de a la
  // línea, que es justo lo que la notación no debe decir.
  const anchor = edgeGeometry(
    association.routing,
    sourceRect,
    targetRect,
    association.waypoints,
    association.source === association.target,
  ).middle

  // Stop at the border of the box, not at its centre: a dashed line crossing
  // the compartments would read as a relation passing through.
  const from = intersectRect(classRect, anchor)
  const center = centerOf(classRect)

  // Degenerate: the box sits on top of the relation.
  if (Math.hypot(anchor.x - center.x, anchor.y - center.y) < 1) return null

  return (
    <line
      x1={from.x}
      y1={from.y}
      x2={anchor.x}
      y2={anchor.y}
      stroke={STROKE}
      strokeWidth={1.5}
      strokeDasharray="6 4"
    />
  )
}

export function AssociationLinks() {
  const nodes = useDiagramStore((state) => state.doc.nodes)
  const activeDiagramId = useDiagramStore((state) => state.activeDiagramId)

  // Re-render while the viewport moves so the layer keeps up with React Flow.
  useStore((state) => state.transform)

  const attached = Object.values(nodes).filter(
    (node) => node.associationId !== null && node.diagramId === activeDiagramId,
  )

  if (attached.length === 0) return null

  return (
    <ViewportPortal>
      {/*
        * Zero-size SVG with overflow visible: the lines are drawn in flow
        * coordinates, so the element only needs to sit at the origin.
        */}
      <svg
        className="pointer-events-none absolute overflow-visible"
        style={{ left: 0, top: 0, width: 1, height: 1, zIndex: 0 }}
      >
        {attached.map((node) => (
          <Link key={node.id} node={node} />
        ))}
      </svg>
    </ViewportPortal>
  )
}
