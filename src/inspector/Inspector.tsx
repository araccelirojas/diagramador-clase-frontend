import { EdgeInspector } from '@/inspector/EdgeInspector'
import { EMPTY_HINT } from '@/inspector/inspectorStyles'
import { NodeInspector } from '@/inspector/NodeInspector'
import { selectSelectedEdge, selectSelectedNode } from '@/state/selectors'
import { useDiagramStore } from '@/state/useDiagramStore'

/**
 * The right-hand panel. It only decides WHAT is selected and delegates; every
 * actual field lives in the specialised editors (CLAUDE.md §4).
 */
export function Inspector() {
  const node = useDiagramStore(selectSelectedNode)
  const edge = useDiagramStore(selectSelectedEdge)
  const selectionCount = useDiagramStore(
    (state) => state.selection.nodes.length + state.selection.edges.length,
  )

  if (node) return <NodeInspector node={node} />
  if (edge) return <EdgeInspector edge={edge} />

  if (selectionCount > 1) {
    return (
      <p className={EMPTY_HINT}>
        {selectionCount} elementos seleccionados. Elegí uno solo para editar sus propiedades.
      </p>
    )
  }

  return (
    <p className={EMPTY_HINT}>
      Seleccioná un clasificador o una relación para ver y editar sus propiedades UML.
    </p>
  )
}
