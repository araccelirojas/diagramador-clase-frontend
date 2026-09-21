import { useCallback } from 'react'

import { checkConnection } from '@/canvas/interaction/connectionRules'
import { addEdge, addEdgeWithClass } from '@/state/commands'
import { useDiagramStore } from '@/state/useDiagramStore'
import { createEdge, createNode } from '@/uml/model/factories'
import type { UmlDocument, UmlEdge } from '@/uml/model/types'
import { compartmentIdsOf, getClassifier, getRelation } from '@/uml/registry'

/**
 * Creates a relation from its spec. Shared by drag-to-connect and by
 * click-source / click-target, so both produce the same edge with the same
 * default ends.
 *
 * When the spec declares `classifierKind` — today only the association class —
 * the box is born with the line, in a single command so the whole gesture is
 * one undo step.
 */

/** Used to centre the box when the node's height comes from its content. */
const NOMINAL_HEIGHT = 90

/** Clear of the line, so the dashed connector reads as a connector. */
const DROP_BELOW = 130

function centreOf(doc: UmlDocument, nodeId: string): { x: number; y: number } | null {
  const node = doc.nodes[nodeId]
  if (!node) return null

  return {
    x: node.position.x + node.size.width / 2,
    y: node.position.y + (node.size.height ?? NOMINAL_HEIGHT) / 2,
  }
}

export function useCreateRelation() {
  const dispatch = useDiagramStore((state) => state.dispatch)
  const activeDiagramId = useDiagramStore((state) => state.activeDiagramId)

  return useCallback(
    (kind: string, sourceId: string, targetId: string): UmlEdge | null => {
      const state = useDiagramStore.getState()
      const check = checkConnection(state.doc, kind, sourceId, targetId)

      // Never refuse in silence: say which rule got in the way.
      if (!check.ok) {
        state.setNotice(check.reason)
        return null
      }
      state.setNotice(null)

      const spec = getRelation(kind)
      const edge = createEdge({
        kind: spec.kind,
        diagramId: activeDiagramId,
        source: sourceId,
        target: targetId,
        ...(spec.defaultEnds ? { ends: spec.defaultEnds } : {}),
      })

      if (spec.classifierKind === undefined) {
        dispatch(addEdge({ edge }))
        return edge
      }

      const classifier = getClassifier(spec.classifierKind)
      const source = centreOf(state.doc, sourceId)
      const target = centreOf(state.doc, targetId)

      // Below the middle of the two classes: where a person would put it, and
      // far enough from the line that the dashed connector is visible at once.
      const anchor =
        source && target
          ? { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 }
          : { x: 0, y: 0 }

      const node = createNode({
        kind: classifier.kind,
        diagramId: activeDiagramId,
        position: {
          x: Math.round(anchor.x - classifier.defaultSize.width / 2),
          y: Math.round(anchor.y + DROP_BELOW),
        },
        compartmentIds: compartmentIdsOf(classifier),
        name: classifier.defaultName,
        keywords: classifier.defaultKeywords ?? [],
        size: classifier.defaultSize,
        associationId: edge.id,
      })

      dispatch(addEdgeWithClass({ edge, node }))
      // Select the box: renaming it is the next thing anyone does.
      state.setSelection({ nodes: [node.id], edges: [] })

      return edge
    },
    [activeDiagramId, dispatch],
  )
}
