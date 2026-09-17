import type { UmlDocument } from '@/uml/model/types'
import { RELATIONS } from '@/uml/registry'

/**
 * The single place that answers "may these two be connected?". The live
 * feedback while dragging, the commit and the explanation shown on rejection
 * all ask this, so the green border can never disagree with what happens on
 * release.
 *
 * The rules themselves live in each RelationSpec (§7.2); this only adds what is
 * true for every relation.
 */

export type ConnectionCheck = { ok: true } | { ok: false; reason: string }

const SELF_REASON =
  'Todavía no se dibujan las relaciones de un elemento consigo mismo (auto-asociación).'

export function checkConnection(
  doc: UmlDocument,
  relationKind: string,
  sourceId: string | null | undefined,
  targetId: string | null | undefined,
): ConnectionCheck {
  if (!sourceId || !targetId) {
    return { ok: false, reason: 'Falta uno de los extremos de la relación.' }
  }

  // Self-associations are legal UML but need a loop path we do not draw yet.
  if (sourceId === targetId) return { ok: false, reason: SELF_REASON }

  const source = doc.nodes[sourceId]
  const target = doc.nodes[targetId]

  if (!source || !target) {
    return { ok: false, reason: 'Uno de los elementos ya no existe.' }
  }

  // Invariant §5.4.1: an edge never crosses diagrams.
  if (source.diagramId !== target.diagramId) {
    return { ok: false, reason: 'Los dos elementos tienen que estar en el mismo diagrama.' }
  }

  const spec = RELATIONS[relationKind]
  if (!spec) {
    return { ok: false, reason: `No hay una relación registrada con el kind "${relationKind}".` }
  }

  if (spec.isValidConnection && !spec.isValidConnection(source, target, doc)) {
    return {
      ok: false,
      reason: spec.connectionHint ?? `Esa combinación no es válida para ${spec.label.toLowerCase()}.`,
    }
  }

  return { ok: true }
}

/** Boolean shortcut for the render path, where the reason is not needed. */
export const canConnect = (
  doc: UmlDocument,
  relationKind: string,
  sourceId: string | null | undefined,
  targetId: string | null | undefined,
): boolean => checkConnection(doc, relationKind, sourceId, targetId).ok
