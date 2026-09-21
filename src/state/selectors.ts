import type { Edge, Node } from '@xyflow/react'

import { SEPARACION_PARALELAS } from '@/canvas/edges/geometry'
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
export type UmlEdgeData = {
  edge: UmlEdge
  /** Cuánto apartarla de las demás que unen su mismo par de clases. Ver `separarParalelas`. */
  separacion: number
}

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

function toFlowEdge(edge: UmlEdge, selected: boolean, separacion: number): UmlFlowEdge {
  return {
    id: edge.id,
    type: edge.kind,
    source: edge.source,
    target: edge.target,
    data: { edge, separacion },
    selected,
  }
}

/**
 * Reparte las relaciones que unen el MISMO par de clases para que no se dibujen una encima
 * de otra.
 *
 * Dos clases con dos asociaciones distintas —"Start" y "Goal" entre Aeropuerto y Vuelo— dan
 * dos líneas idénticas punto por punto: parecen una sola y las multiplicidades se amontonan.
 * Aquí se decide cuánto se aparta cada una; la geometría se encarga de aplicarlo.
 *
 * El par se toma SIN dirección: A→B y B→A también coinciden sobre el papel. Como el sentido
 * de "apartarse" lo fija el eje origen→destino, a la relación que va al revés se le invierte
 * el signo, o las dos acabarían del mismo lado.
 */
function separarParalelas(edges: readonly UmlEdge[]): Map<string, number> {
  const grupos = new Map<string, UmlEdge[]>()

  for (const edge of edges) {
    const clave = [edge.source, edge.target].sort().join('|')
    const grupo = grupos.get(clave)

    if (grupo) grupo.push(edge)
    else grupos.set(clave, [edge])
  }

  const separaciones = new Map<string, number>()

  for (const grupo of grupos.values()) {
    // Una sola relación entre ese par: se queda donde siempre, sin desplazar.
    if (grupo.length === 1) {
      separaciones.set(grupo[0]!.id, 0)
      continue
    }

    grupo.forEach((edge, indice) => {
      if (edge.source === edge.target) {
        // Un bucle no se aparta de lado: se agranda, o quedaría montado sobre el anterior.
        separaciones.set(edge.id, indice * SEPARACION_PARALELAS)
        return
      }

      const centrado = (indice - (grupo.length - 1) / 2) * SEPARACION_PARALELAS
      separaciones.set(edge.id, edge.source > edge.target ? -centrado : centrado)
    })
  }

  return separaciones
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
  const delDiagrama = Object.values(state.doc.edges).filter(
    (edge) => edge.diagramId === state.activeDiagramId,
  )

  const separaciones = separarParalelas(delDiagrama)
  const value = delDiagrama.map((edge) =>
    toFlowEdge(edge, selected.has(edge.id), separaciones.get(edge.id) ?? 0),
  )

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
