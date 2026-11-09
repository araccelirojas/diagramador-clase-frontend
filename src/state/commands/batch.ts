import { applyCommand, defineCommand, type Command } from '@/state/commands/defineCommand'
import type { UmlDocument, UmlEdge, UmlNode } from '@/uml/model/types'

/**
 * Commands that carry other commands, or whole entities (CU-04).
 *
 * A change proposed by the AI is several commands — create a class, give it
 * three attributes, connect it — but for the room it is ONE thing that gets
 * voted on, kept or thrown away together. `applyBatch` is that one thing: one
 * message on the socket, one entry in the history, all or nothing.
 */

/**
 * Applies its commands in order, over the same draft. If one of them throws
 * (an unknown name, say), immer discards the draft and none of them lands.
 */
export const applyBatch = defineCommand(
  'document.batch',
  (draft, payload: { commands: Command[] }) => {
    for (const command of payload.commands) applyCommand(draft, command)
  },
)

/**
 * Entities as they must end up: a node or edge to put back as it was, or
 * `null` for one that must not exist. Serializable on purpose — this is what
 * the room receives to undo an AI change that was voted down.
 */
export type EntityRestore = {
  nodes: Record<string, UmlNode | null>
  edges: Record<string, UmlEdge | null>
}

/**
 * Puts entities back as they were, then repairs what that may have broken.
 *
 * The repair is not optional. Between the AI change and the vote people kept
 * editing: someone may have connected a relation to a class the AI created,
 * or deleted the package a restored class lived in. Restoring blindly would
 * leave an edge pointing at nothing, which is a corrupt document (§5.4).
 */
export const restoreEntities = defineCommand(
  'document.restoreEntities',
  (draft, payload: EntityRestore) => {
    for (const [id, node] of Object.entries(payload.nodes)) {
      if (node === null) delete draft.nodes[id]
      else draft.nodes[id] = node
    }
    for (const [id, edge] of Object.entries(payload.edges)) {
      if (edge === null) delete draft.edges[id]
      else draft.edges[id] = edge
    }

    repairReferences(draft)
  },
)

/**
 * The cascades of §5.4, run until nothing changes: a dropped edge can take an
 * association class with it, and that class its own edges.
 */
function repairReferences(draft: UmlDocument): void {
  let changed = true

  while (changed) {
    changed = false

    for (const [id, edge] of Object.entries(draft.edges)) {
      const source = draft.nodes[edge.source]
      const target = draft.nodes[edge.target]
      // §5.4.1: both ends exist and live in the same diagram as the edge.
      if (
        !source ||
        !target ||
        source.diagramId !== edge.diagramId ||
        target.diagramId !== edge.diagramId
      ) {
        delete draft.edges[id]
        changed = true
      }
    }

    for (const [id, node] of Object.entries(draft.nodes)) {
      if (node.associationId === null) continue
      const edge = draft.edges[node.associationId]
      // §5.4.6: an association class hanging from nothing goes with it.
      if (!edge || edge.diagramId !== node.diagramId) {
        delete draft.nodes[id]
        changed = true
      }
    }
  }

  // §5.4.2: a parent that is gone, or is no longer a package, lets go.
  // Replaced, not assigned in place: a node that was just restored is the frozen
  // object from the payload, not an immer draft.
  for (const [id, node] of Object.entries(draft.nodes)) {
    if (node.parentId === null) continue
    if (draft.nodes[node.parentId]?.kind !== 'package') draft.nodes[id] = { ...node, parentId: null }
  }
}

/**
 * What changed between two versions of the document, in the shape that undoes
 * it. Relies on immer's structural sharing: an entity nobody touched keeps its
 * reference, so `!==` is exactly "this one changed".
 */
export function entitiesToRestore(before: UmlDocument, after: UmlDocument): EntityRestore {
  const restore: EntityRestore = { nodes: {}, edges: {} }

  for (const id of new Set([...Object.keys(before.nodes), ...Object.keys(after.nodes)])) {
    if (before.nodes[id] !== after.nodes[id]) restore.nodes[id] = before.nodes[id] ?? null
  }
  for (const id of new Set([...Object.keys(before.edges), ...Object.keys(after.edges)])) {
    if (before.edges[id] !== after.edges[id]) restore.edges[id] = before.edges[id] ?? null
  }

  return restore
}
