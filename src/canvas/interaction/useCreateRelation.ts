import { useCallback } from 'react'

import { checkConnection } from '@/canvas/interaction/connectionRules'
import { addEdge } from '@/state/commands'
import { useDiagramStore } from '@/state/useDiagramStore'
import { createEdge } from '@/uml/model/factories'
import type { UmlEdge } from '@/uml/model/types'
import { getRelation } from '@/uml/registry'

/**
 * Creates a relation from its spec. Shared by drag-to-connect and by
 * click-source / click-target, so both produce the same edge with the same
 * default ends.
 */
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

      dispatch(addEdge({ edge }))
      return edge
    },
    [activeDiagramId, dispatch],
  )
}
