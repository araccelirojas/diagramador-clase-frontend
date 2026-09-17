import { defineCommand } from '@/state/commands/defineCommand'
import type { NodeStyle, Position, Size, UmlNode, Visibility } from '@/uml/model/types'

/** Commands over classifiers. Each one touches as little as possible (§11.4). */

export const addNode = defineCommand('node.add', (draft, payload: { node: UmlNode }) => {
  draft.nodes[payload.node.id] = payload.node
})

/**
 * Invariant §5.4.4: deleting a node cascades to its incident edges and
 * un-parents its children. Never leave a dangling reference behind.
 */
export const removeNodes = defineCommand('node.remove', (draft, payload: { ids: string[] }) => {
  const removed = new Set(payload.ids)

  for (const id of removed) {
    delete draft.nodes[id]
  }

  for (const [edgeId, edge] of Object.entries(draft.edges)) {
    if (removed.has(edge.source) || removed.has(edge.target)) {
      delete draft.edges[edgeId]
    }
  }

  for (const node of Object.values(draft.nodes)) {
    if (node.parentId !== null && removed.has(node.parentId)) {
      node.parentId = null
    }
  }
})

/** Committed once when the drag ends, never on every pointer move (§6.3). */
export const moveNodes = defineCommand(
  'node.move',
  (draft, payload: { ids: string[]; delta: Position }) => {
    for (const id of payload.ids) {
      const node = draft.nodes[id]
      if (!node) continue

      node.position.x += payload.delta.x
      node.position.y += payload.delta.y
    }
  },
)

/** Absolute placement, used by drop and by paste; drags use moveNodes. */
export const setNodePosition = defineCommand(
  'node.setPosition',
  (draft, payload: { id: string; position: Position }) => {
    const node = draft.nodes[payload.id]
    if (!node) return

    node.position.x = payload.position.x
    node.position.y = payload.position.y
  },
)

export const resizeNode = defineCommand(
  'node.resize',
  (draft, payload: { id: string; size: Size }) => {
    const node = draft.nodes[payload.id]
    if (!node) return

    node.size.width = payload.size.width
    node.size.height = payload.size.height
  },
)

export const renameNode = defineCommand(
  'node.rename',
  (draft, payload: { id: string; name: string }) => {
    const node = draft.nodes[payload.id]
    if (!node) return

    node.name = payload.name
  },
)

export const setNodeAbstract = defineCommand(
  'node.setAbstract',
  (draft, payload: { id: string; isAbstract: boolean }) => {
    const node = draft.nodes[payload.id]
    if (!node) return

    node.isAbstract = payload.isAbstract
  },
)

export const setNodeVisibility = defineCommand(
  'node.setVisibility',
  (draft, payload: { id: string; visibility: Visibility }) => {
    const node = draft.nodes[payload.id]
    if (!node) return

    node.visibility = payload.visibility
  },
)

export const setNodeKeywords = defineCommand(
  'node.setKeywords',
  (draft, payload: { id: string; keywords: string[] }) => {
    const node = draft.nodes[payload.id]
    if (!node) return

    node.keywords = [...payload.keywords]
  },
)

export const setNodeStyle = defineCommand(
  'node.setStyle',
  (draft, payload: { id: string; style: NodeStyle | null }) => {
    const node = draft.nodes[payload.id]
    if (!node) return

    if (payload.style === null) {
      delete node.style
      return
    }
    node.style = { ...payload.style }
  },
)

export const setNodeZ = defineCommand('node.setZ', (draft, payload: { id: string; z: number }) => {
  const node = draft.nodes[payload.id]
  if (!node) return

  node.z = payload.z
})

/** Re-parenting into a package. The schema rejects cycles; so do we, up front. */
export const setNodeParent = defineCommand(
  'node.setParent',
  (draft, payload: { id: string; parentId: string | null }) => {
    const node = draft.nodes[payload.id]
    if (!node) return

    if (payload.parentId === null) {
      node.parentId = null
      return
    }
    if (payload.parentId === payload.id) return

    // Walk up from the candidate parent: if we meet the node, this closes a cycle.
    const seen = new Set<string>()
    let ancestorId: string | null = payload.parentId

    while (ancestorId !== null) {
      if (ancestorId === payload.id || seen.has(ancestorId)) return
      seen.add(ancestorId)
      ancestorId = draft.nodes[ancestorId]?.parentId ?? null
    }

    node.parentId = payload.parentId
  },
)
