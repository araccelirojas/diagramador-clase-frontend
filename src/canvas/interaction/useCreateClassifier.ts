import { useCallback } from 'react'

import { addNode } from '@/state/commands'
import { useDiagramStore } from '@/state/useDiagramStore'
import { createNode } from '@/uml/model/factories'
import type { Position, UmlNode } from '@/uml/model/types'
import { compartmentIdsOf, getClassifier } from '@/uml/registry'

/**
 * Creates a classifier from its spec. Shared by the palette drop and by
 * click-to-place so both paths produce exactly the same node.
 *
 * `variantId` picks one of the spec's palette variants (for example "Clase
 * abstracta", which is a class with isAbstract: true).
 */
export function useCreateClassifier() {
  const dispatch = useDiagramStore((state) => state.dispatch)
  const activeDiagramId = useDiagramStore((state) => state.activeDiagramId)

  return useCallback(
    (kind: string, position: Position, variantId?: string): UmlNode => {
      const spec = getClassifier(kind)
      const variant = spec.variants?.find((candidate) => candidate.id === variantId)

      const node = createNode({
        kind: spec.kind,
        diagramId: activeDiagramId,
        // Drop and click place the box centred on the pointer, not hanging off it.
        position: {
          x: Math.round(position.x - spec.defaultSize.width / 2),
          y: Math.round(position.y - 20),
        },
        compartmentIds: compartmentIdsOf(spec),
        name: variant?.defaults.name ?? spec.defaultName,
        keywords: variant?.defaults.keywords ?? spec.defaultKeywords ?? [],
        isAbstract: variant?.defaults.isAbstract ?? false,
        size: spec.defaultSize,
      })

      dispatch(addNode({ node }))
      return node
    },
    [activeDiagramId, dispatch],
  )
}
