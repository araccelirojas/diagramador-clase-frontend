import type { Edge, Node } from '@xyflow/react'

import { SEPARACION_PARALELAS } from '@/canvas/edges/geometry'
import type { DiagramState } from '@/state/useDiagramStore'
import { participantColor, type Participant } from '@/sync/presence'
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
  /** Someone else in the room has it selected (CU-01): drawn as a halo in their color. */
  remoteColor?: string
  /** Changed by the AI and still being voted on (CU-04): drawn dashed in violet. */
  provisional?: boolean
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

/* ------------------------------------------------------------------------ */
/* Remote selections (CU-01)                                                 */
/* ------------------------------------------------------------------------ */

export type RemoteHighlight = { idSocket: string; color: string; nombre: string }

export type RemoteHighlights = {
  nodes: ReadonlyMap<string, RemoteHighlight[]>
  edges: ReadonlyMap<string, RemoteHighlight[]>
}

export const NO_REMOTE_HIGHLIGHTS: RemoteHighlights = { nodes: new Map(), edges: new Map() }

/**
 * Which elements other people in the room have selected, and by whom. This
 * client's own selection is not here: it already has its own blue.
 */
export function selectRemoteHighlights(
  participants: Readonly<Record<string, Participant>>,
  selfId: string | null,
): RemoteHighlights {
  const nodes = new Map<string, RemoteHighlight[]>()
  const edges = new Map<string, RemoteHighlight[]>()

  const add = (map: Map<string, RemoteHighlight[]>, id: string, highlight: RemoteHighlight) => {
    const list = map.get(id)
    if (list) list.push(highlight)
    else map.set(id, [highlight])
  }

  for (const participant of Object.values(participants)) {
    if (participant.idSocket === selfId || participant.estado === 'desconectado') continue

    const highlight = {
      idSocket: participant.idSocket,
      color: participantColor(participant.idUsuario),
      nombre: participant.nombre,
    }

    for (const id of participant.seleccion.nodos) add(nodes, id, highlight)
    for (const id of participant.seleccion.aristas) add(edges, id, highlight)
  }

  return nodes.size === 0 && edges.size === 0 ? NO_REMOTE_HIGHLIGHTS : { nodes, edges }
}

/**
 * A ring per person around the box, outermost last. A box-shadow and not a
 * border: it does not take room, so the box does not grow a pixel and the
 * edges anchored to its border do not shift.
 */
export function withRemoteNodeHighlights(
  nodes: UmlFlowNode[],
  highlights: RemoteHighlights,
): UmlFlowNode[] {
  if (highlights.nodes.size === 0) return nodes

  return nodes.map((node) => {
    const list = highlights.nodes.get(node.id)
    if (!list) return node

    const rings = list.map((h, index) => `0 0 0 ${2 * (index + 1)}px ${h.color}`).join(', ')
    return { ...node, style: { ...node.style, boxShadow: rings } }
  })
}

/** One halo per edge: the first person who selected it. */
export function withRemoteEdgeHighlights(
  edges: UmlFlowEdge[],
  highlights: RemoteHighlights,
): UmlFlowEdge[] {
  if (highlights.edges.size === 0) return edges

  return edges.map((edge) => {
    const first = highlights.edges.get(edge.id)?.[0]
    if (!first || !edge.data) return edge

    return { ...edge, data: { ...edge.data, remoteColor: first.color } }
  })
}

/* ------------------------------------------------------------------------ */
/* Provisional AI changes (CU-04)                                            */
/* ------------------------------------------------------------------------ */

export type ProvisionalMarks = { nodes: ReadonlySet<string>; edges: ReadonlySet<string> }

export const NO_PROVISIONAL: ProvisionalMarks = { nodes: new Set(), edges: new Set() }

/** The violet of everything the AI does, here and in the chat. */
export const PROVISIONAL_COLOR = '#8b5cf6'

/** What the AI changed, while the room is still voting on it. Nothing once it closed. */
export function selectProvisional(
  vote: { estado: string; nodos: string[]; aristas: string[] } | null,
): ProvisionalMarks {
  if (!vote || vote.estado !== 'abierta') return NO_PROVISIONAL
  if (vote.nodos.length === 0 && vote.aristas.length === 0) return NO_PROVISIONAL

  return { nodes: new Set(vote.nodos), edges: new Set(vote.aristas) }
}

/**
 * A dashed outline a few pixels out. An outline, like the remote rings, takes
 * no room: the box keeps its size and the edges anchored to it do not move.
 */
export function withProvisionalNodes(nodes: UmlFlowNode[], marks: ProvisionalMarks): UmlFlowNode[] {
  if (marks.nodes.size === 0) return nodes

  return nodes.map((node) =>
    marks.nodes.has(node.id)
      ? {
          ...node,
          style: { ...node.style, outline: `2px dashed ${PROVISIONAL_COLOR}`, outlineOffset: 6 },
        }
      : node,
  )
}

export function withProvisionalEdges(edges: UmlFlowEdge[], marks: ProvisionalMarks): UmlFlowEdge[] {
  if (marks.edges.size === 0) return edges

  return edges.map((edge) =>
    marks.edges.has(edge.id) && edge.data ? { ...edge, data: { ...edge.data, provisional: true } } : edge,
  )
}
