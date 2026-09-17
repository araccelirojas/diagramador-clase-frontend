import { useReactFlow } from '@xyflow/react'
import { useEffect } from 'react'

import { moveNodes, removeEdges, removeNodes } from '@/state/commands'
import { useDiagramStore } from '@/state/useDiagramStore'

/** Keyboard shortcuts (CLAUDE.md §9). */

const NUDGE = 1
const NUDGE_FAST = 10

const ARROW_DELTA: Record<string, { x: number; y: number }> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
}

/** A shortcut must never fire while the user is typing a class name. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

export function useKeyboard(): void {
  const { fitView } = useReactFlow()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTyping(event.target)) return

      const state = useDiagramStore.getState()
      const { selection } = state
      const modifier = event.ctrlKey || event.metaKey

      if (event.key === 'Escape') {
        state.setTool({ kind: 'select' })
        state.setPendingConnection(null)
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selection.nodes.length > 0) state.dispatch(removeNodes({ ids: selection.nodes }))
        if (selection.edges.length > 0) state.dispatch(removeEdges({ ids: selection.edges }))
        return
      }

      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) state.redo()
        else state.undo()
        return
      }

      if (modifier && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        state.redo()
        return
      }

      if (modifier && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        const { doc, activeDiagramId } = state
        state.setSelection({
          nodes: Object.values(doc.nodes)
            .filter((node) => node.diagramId === activeDiagramId)
            .map((node) => node.id),
          edges: Object.values(doc.edges)
            .filter((edge) => edge.diagramId === activeDiagramId)
            .map((edge) => edge.id),
        })
        return
      }

      if (modifier && event.key === '0') {
        event.preventDefault()
        void fitView({ duration: 200 })
        return
      }

      const direction = ARROW_DELTA[event.key]
      if (direction && selection.nodes.length > 0) {
        event.preventDefault()
        const step = event.shiftKey ? NUDGE_FAST : NUDGE
        state.dispatch(
          moveNodes({
            ids: selection.nodes,
            delta: { x: direction.x * step, y: direction.y * step },
          }),
        )
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fitView])
}
