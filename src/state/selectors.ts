import type { Edge, Node } from '@xyflow/react'

import type { DiagramState } from '@/state/useDiagramStore'
import type { UmlDocument, UmlEdge, UmlNode } from '@/uml/model/types'

/**
 * Derivations, including the React Flow adapter (CLAUDE.md §6.3).
 *
 * The document stores `nodes` and `edges` as Record<id, T>; React Flow needs
 * arrays. That conversion happens here, memoized and filtered by the active
 * diagram. Never store the React Flow array as state: it is a derivation.
 */

export type UmlNodeData = { node: UmlNode }
export type UmlEdgeData = { edge: UmlEdge }

export type UmlFlowNode = Node<UmlNodeData>
export type UmlFlowEdge = Edge<UmlEdgeData>

function toFlowNode(node: UmlNode, selected: boolean): UmlFlowNode {
  return {
    id: node.id,
    type: node.kind,
    // Copied: the document is frozen and React Flow expects to own this object.
    position: { ...node.position },
    data: { node },
    selected,
    zIndex: node.z,
    style: {
      width: node.size.width,
      ...(node.size.height === null ? {} : { height: node.size.height }),
    },
    ...(node.parentId === null ? {} : { parentId: node.parentId }),
  }
}

function toFlowEdge(edge: UmlEdge, selected: boolean): UmlFlowEdge {
  return {
    id: edge.id,
    type: edge.kind,
    source: edge.source,
    target: edge.target,
    data: { edge },
    selected,
  }
}

/** One-entry cache: there is a single store, so this is enough and stays honest. */
type Cache<T> = { doc: UmlDocument; diagramId: string; selectionKey: string; value: T } | null

let nodeCache: Cache<UmlFlowNode[]> = null
let edgeCache: Cache<UmlFlowEdge[]> = null

const keyOf = (ids: readonly string[]): string => ids.join(' ')

export function selectFlowNodes(state: DiagramState): UmlFlowNode[] {
  const selectionKey = keyOf(state.selection.nodes)

  if (
    nodeCache &&
    nodeCache.doc === state.doc &&
    nodeCache.diagramId === state.activeDiagramId &&
    nodeCache.selectionKey === selectionKey
  ) {
    return nodeCache.value
  }

  const selected = new Set(state.selection.nodes)
  const value = Object.values(state.doc.nodes)
    .filter((node) => node.diagramId === state.activeDiagramId)
    .map((node) => toFlowNode(node, selected.has(node.id)))

  nodeCache = { doc: state.doc, diagramId: state.activeDiagramId, selectionKey, value }
  return value
}

export function selectFlowEdges(state: DiagramState): UmlFlowEdge[] {
  const selectionKey = keyOf(state.selection.edges)

  if (
    edgeCache &&
    edgeCache.doc === state.doc &&
    edgeCache.diagramId === state.activeDiagramId &&
    edgeCache.selectionKey === selectionKey
  ) {
    return edgeCache.value
  }

  const selected = new Set(state.selection.edges)
  const value = Object.values(state.doc.edges)
    .filter((edge) => edge.diagramId === state.activeDiagramId)
    .map((edge) => toFlowEdge(edge, selected.has(edge.id)))

  edgeCache = { doc: state.doc, diagramId: state.activeDiagramId, selectionKey, value }
  return value
}

export function selectActiveDiagram(state: DiagramState) {
  return state.doc.diagrams.find((diagram) => diagram.id === state.activeDiagramId)
}

export function selectNodeById(state: DiagramState, id: string): UmlNode | undefined {
  return state.doc.nodes[id]
}

/** The inspector edits one element at a time. */
export function selectSelectedNode(state: DiagramState): UmlNode | undefined {
  const [id, ...rest] = state.selection.nodes
  if (id === undefined || rest.length > 0) return undefined

  return state.doc.nodes[id]
}

export function selectSelectedEdge(state: DiagramState): UmlEdge | undefined {
  const [id, ...rest] = state.selection.edges
  if (id === undefined || rest.length > 0) return undefined

  return state.doc.edges[id]
}

/** Incident edges of a node, to highlight them on selection (§9). */
export function selectIncidentEdgeIds(state: DiagramState, nodeId: string): string[] {
  return Object.values(state.doc.edges)
    .filter((edge) => edge.source === nodeId || edge.target === nodeId)
    .map((edge) => edge.id)
}
