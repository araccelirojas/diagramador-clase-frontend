import { useReactFlow } from '@xyflow/react'
import { useCallback, type DragEvent } from 'react'

import { useAddMember } from '@/canvas/interaction/useAddMember'
import { useCreateClassifier } from '@/canvas/interaction/useCreateClassifier'
import type { MemberKind } from '@/uml/model/types'

/**
 * Native HTML5 drag and drop from the palette (CLAUDE.md §9). No react-dnd:
 * this is the whole implementation.
 *
 * The screen -> world conversion is `screenToFlowPosition`. Never do the zoom
 * arithmetic by hand — that was exactly the previous project's mistake.
 */

export const PALETTE_MIME = 'application/x-uml-tool'

export type PaletteDragPayload =
  | { tool: 'classifier'; classifierKind: string; variantId?: string }
  | { tool: 'member'; memberKind: MemberKind }

export function serializePaletteDrag(payload: PaletteDragPayload): string {
  return JSON.stringify(payload)
}

function parsePaletteDrag(raw: string): PaletteDragPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw)

    if (typeof parsed === 'object' && parsed !== null) {
      const tool = (parsed as { tool?: unknown }).tool
      if (tool === 'classifier' || tool === 'member') return parsed as PaletteDragPayload
    }
  } catch {
    // A drop from outside the app: ignore it rather than crash the canvas.
  }

  return null
}

export function usePaletteDrop() {
  const { screenToFlowPosition, getIntersectingNodes } = useReactFlow()
  const createClassifier = useCreateClassifier()
  const addMemberTo = useAddMember()

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()

      const payload = parsePaletteDrag(event.dataTransfer.getData(PALETTE_MIME))
      if (!payload) return

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })

      if (payload.tool === 'classifier') {
        createClassifier(payload.classifierKind, position, payload.variantId)
        return
      }

      // A member needs a classifier under the pointer to land in.
      const under = getIntersectingNodes({ ...position, width: 1, height: 1 })
      const target = under[under.length - 1]

      if (target) addMemberTo(target.id, payload.memberKind)
    },
    [addMemberTo, createClassifier, getIntersectingNodes, screenToFlowPosition],
  )

  return { onDragOver, onDrop }
}
