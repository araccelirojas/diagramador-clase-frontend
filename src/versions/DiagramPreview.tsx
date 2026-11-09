import { useMemo } from 'react'

import { edgeGeometry, labelAnchor, type Rect } from '@/canvas/edges/geometry'
import { markerUrl } from '@/canvas/markers/markerIds'
import { formatKeywords, formatMember } from '@/uml/model/format'
import type { UmlDocument, UmlEdge, UmlNode } from '@/uml/model/types'
import { getClassifier, getRelation, hasClassifier, hasRelation } from '@/uml/registry'

/**
 * A version of the diagram, drawn read-only (CU-05).
 *
 * Its own small SVG and not the canvas: the node components read and write the
 * LIVE document through the store, so mounting them on an old version would
 * mix the two — and one double-click would rename a class in everyone's
 * diagram. This draws the same boxes, lines and arrow heads (the edge geometry
 * and the `<marker>`s are shared with the canvas), and cannot edit anything.
 */

const HEADER_LINE = 18
const KEYWORD_LINE = 14
const MEMBER_LINE = 16
const COMPARTMENT_PADDING = 6
const MARGIN = 40
const LABEL_ALONG = 26
const LABEL_SIDE = 11

type Box = {
  node: UmlNode
  rect: Rect
  keywords: string | null
  /** Baselines of the header lines, in world coordinates. */
  keywordY: number
  nameY: number
  compartments: { top: number; lines: string[] }[]
}

/** Where everything in a box goes. Pure: the drawing only reads it. */
function layoutBox(node: UmlNode): Box {
  const spec = hasClassifier(node.kind) ? getClassifier(node.kind) : null
  const keywords = formatKeywords(node.keywords)
  const contents = (spec?.compartments ?? [])
    .map((compartment) => (node.compartments[compartment.id] ?? []).map(formatMember))
    .filter((lines, index) => lines.length > 0 || !spec?.compartments[index]?.hideWhenEmpty)

  const { y } = node.position
  const keywordY = y + COMPARTMENT_PADDING + KEYWORD_LINE - 3
  const nameY = y + COMPARTMENT_PADDING + (keywords ? KEYWORD_LINE : 0) + HEADER_LINE - 4

  let top = y + HEADER_LINE + (keywords ? KEYWORD_LINE : 0) + COMPARTMENT_PADDING * 2
  const compartments = contents.map((lines) => {
    const placed = { top, lines }
    top += Math.max(lines.length, 1) * MEMBER_LINE + COMPARTMENT_PADDING * 2
    return placed
  })

  return {
    node,
    keywords,
    keywordY,
    nameY,
    compartments,
    rect: { x: node.position.x, y, width: node.size.width, height: node.size.height ?? top - y },
  }
}

function ClassBox({ box }: { box: Box }) {
  const { node, rect, keywords, compartments } = box
  const spec = hasClassifier(node.kind) ? getClassifier(node.kind) : null
  const italic = node.isAbstract || spec?.nameStyle?.italic
  const centerX = rect.x + rect.width / 2

  const header = (
    <>
      {keywords && (
        <text x={centerX} y={box.keywordY} textAnchor="middle" fontSize={11} fill="#475569">
          {keywords}
        </text>
      )}
      <text
        x={centerX}
        y={box.nameY}
        textAnchor="middle"
        fontSize={13}
        fontWeight={600}
        fontStyle={italic ? 'italic' : 'normal'}
        fill="#0f172a"
      >
        {node.name}
      </text>
    </>
  )
  return (
    <g>
      <rect {...rect} rx={2} fill={node.style?.fill ?? '#ffffff'} stroke={node.style?.stroke ?? '#334155'} />
      {header}
      {compartments.map(({ top, lines }, index) => {
        return (
          <g key={index}>
            <line x1={rect.x} x2={rect.x + rect.width} y1={top} y2={top} stroke="#334155" />
            {lines.map((line, i) => (
              <text key={i} x={rect.x + 8} y={top + COMPARTMENT_PADDING + (i + 1) * MEMBER_LINE - 4} fontSize={11} fill="#1e293b">
                {line}
              </text>
            ))}
          </g>
        )
      })}
    </g>
  )
}

function Relation({ edge, boxes }: { edge: UmlEdge; boxes: Map<string, Box> }) {
  const source = boxes.get(edge.source)
  const target = boxes.get(edge.target)
  if (!source || !target || !hasRelation(edge.kind)) return null

  const spec = getRelation(edge.kind)
  const geometry = edgeGeometry(edge.routing, source.rect, target.rect, edge.waypoints, edge.source === edge.target)
  const near = (end: 'source' | 'target') => {
    const point = geometry[end]
    const next = end === 'source' ? geometry.points[1] : geometry.points[geometry.points.length - 2]
    return labelAnchor(point, next ?? point, LABEL_ALONG, end === 'source' ? -LABEL_SIDE : LABEL_SIDE)
  }

  const labels: { at: { x: number; y: number }; text: string }[] = []
  if (spec.supports.multiplicity) {
    if (edge.ends.source.multiplicity) labels.push({ at: near('source'), text: edge.ends.source.multiplicity })
    if (edge.ends.target.multiplicity) labels.push({ at: near('target'), text: edge.ends.target.multiplicity })
  }
  if (spec.supports.name && edge.name) labels.push({ at: geometry.middle, text: edge.name })

  return (
    <g>
      <path
        d={geometry.path}
        fill="none"
        stroke="#334155"
        strokeWidth={1.5}
        strokeDasharray={spec.line === 'dashed' ? '6 4' : undefined}
        markerStart={markerUrl(spec.sourceMarker)}
        markerEnd={markerUrl(spec.targetMarker)}
      />
      {labels.map((label, index) => (
        <text key={index} x={label.at.x} y={label.at.y} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#475569">
          {label.text}
        </text>
      ))}
    </g>
  )
}

export function DiagramPreview({ doc }: { doc: UmlDocument }) {
  const diagramId = doc.diagrams[0]?.id

  const { boxes, edges, viewBox } = useMemo(() => {
    const nodes = Object.values(doc.nodes).filter((n) => n.diagramId === diagramId)
    const boxes = new Map(nodes.map((n) => [n.id, layoutBox(n)]))
    const edges = Object.values(doc.edges).filter((e) => e.diagramId === diagramId)

    const rects = [...boxes.values()].map((b) => b.rect)
    if (rects.length === 0) return { boxes, edges, viewBox: '0 0 400 200' }

    const minX = Math.min(...rects.map((r) => r.x)) - MARGIN
    const minY = Math.min(...rects.map((r) => r.y)) - MARGIN
    const maxX = Math.max(...rects.map((r) => r.x + r.width)) + MARGIN
    const maxY = Math.max(...rects.map((r) => r.y + r.height)) + MARGIN
    return { boxes, edges, viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}` }
  }, [doc, diagramId])

  if (boxes.size === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">Esta versión no tiene clases.</p>
  }

  return (
    <svg viewBox={viewBox} className="h-full w-full" role="img" aria-label="Diagrama de la versión, solo lectura">
      {edges.map((edge) => (
        <Relation key={edge.id} edge={edge} boxes={boxes} />
      ))}
      {/* Association classes hang from the middle of their line with a dashed connector. */}
      {[...boxes.values()].map((box) => {
        const edge = box.node.associationId ? doc.edges[box.node.associationId] : undefined
        const source = edge && boxes.get(edge.source)
        const target = edge && boxes.get(edge.target)
        if (!edge || !source || !target) return null
        const middle = edgeGeometry(edge.routing, source.rect, target.rect, edge.waypoints, edge.source === edge.target).middle
        return (
          <line
            key={`assoc-${box.node.id}`}
            x1={middle.x}
            y1={middle.y}
            x2={box.rect.x + box.rect.width / 2}
            y2={box.rect.y}
            stroke="#334155"
            strokeDasharray="4 4"
          />
        )
      })}
      {[...boxes.values()].map((box) => (
        <ClassBox key={box.node.id} box={box} />
      ))}
    </svg>
  )
}
