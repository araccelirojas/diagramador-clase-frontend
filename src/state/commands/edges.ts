import { defineCommand } from '@/state/commands/defineCommand'
import type {
  AssociationEnd,
  EdgeRouting,
  NameDirection,
  Position,
  UmlEdge,
} from '@/uml/model/types'

/** Commands over relations. */

export const addEdge = defineCommand('edge.add', (draft, payload: { edge: UmlEdge }) => {
  const { edge } = payload

  // Invariant §5.4.1: never store an edge whose endpoints are not both there.
  if (!draft.nodes[edge.source] || !draft.nodes[edge.target]) return

  draft.edges[edge.id] = edge
})

export const removeEdges = defineCommand('edge.remove', (draft, payload: { ids: string[] }) => {
  for (const id of payload.ids) {
    delete draft.edges[id]
  }
})

export const setEdgeName = defineCommand(
  'edge.setName',
  (draft, payload: { id: string; name: string | null }) => {
    const edge = draft.edges[payload.id]
    if (!edge) return

    edge.name = payload.name
  },
)

export const setEdgeNameDirection = defineCommand(
  'edge.setNameDirection',
  (draft, payload: { id: string; nameDirection: NameDirection }) => {
    const edge = draft.edges[payload.id]
    if (!edge) return

    edge.nameDirection = payload.nameDirection
  },
)

/**
 * One end, one field. Fine-grained on purpose: fewer conflicts between
 * simultaneous users and less traffic in phase 4 (§11.4).
 */
export const setEdgeEnd = defineCommand(
  'edge.setEnd',
  (draft, payload: { id: string; side: 'source' | 'target'; patch: Partial<AssociationEnd> }) => {
    const edge = draft.edges[payload.id]
    if (!edge) return

    Object.assign(edge.ends[payload.side], payload.patch)
  },
)

export const setEdgeRouting = defineCommand(
  'edge.setRouting',
  (draft, payload: { id: string; routing: EdgeRouting }) => {
    const edge = draft.edges[payload.id]
    if (!edge) return

    edge.routing = payload.routing
  },
)

export const setEdgeWaypoints = defineCommand(
  'edge.setWaypoints',
  (draft, payload: { id: string; waypoints: Position[] }) => {
    const edge = draft.edges[payload.id]
    if (!edge) return

    edge.waypoints = payload.waypoints.map((point) => ({ ...point }))
  },
)

/** Dragging an endpoint onto another node. */
export const reconnectEdge = defineCommand(
  'edge.reconnect',
  (draft, payload: { id: string; side: 'source' | 'target'; nodeId: string }) => {
    const edge = draft.edges[payload.id]
    if (!edge) return

    const node = draft.nodes[payload.nodeId]
    if (!node || node.diagramId !== edge.diagramId) return

    edge[payload.side] = payload.nodeId
  },
)
