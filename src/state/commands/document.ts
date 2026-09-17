import { defineCommand } from '@/state/commands/defineCommand'
import type { Viewport } from '@/uml/model/types'

/** Commands over the document itself and its diagrams. */

export const setDocumentName = defineCommand(
  'document.setName',
  (draft, payload: { name: string }) => {
    draft.meta.name = payload.name
  },
)

export const renameDiagram = defineCommand(
  'diagram.rename',
  (draft, payload: { id: string; name: string }) => {
    const diagram = draft.diagrams.find((candidate) => candidate.id === payload.id)
    if (!diagram) return

    diagram.name = payload.name
  },
)

/**
 * Pan and zoom. Dispatched once per gesture (on move end), and always with
 * `{ history: false }`: nobody expects Ctrl+Z to undo a scroll.
 */
export const setViewport = defineCommand(
  'diagram.setViewport',
  (draft, payload: { id: string; viewport: Viewport }) => {
    const diagram = draft.diagrams.find((candidate) => candidate.id === payload.id)
    if (!diagram) return

    diagram.viewport = { ...payload.viewport }
  },
)
