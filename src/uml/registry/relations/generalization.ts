import { Triangle } from 'lucide-react'

import type { UmlDocument, UmlNode } from '@/uml/model/types'
import type { RelationSpec } from '@/uml/registry/types'

const GENERALIZATION_KIND = 'generalization'

/**
 * True when `ancestorId` can already be reached from `nodeId` following
 * generalizations: adding one more would close an inheritance cycle.
 *
 * This rule lives in the spec, not in validators.ts, so that adding a relation
 * never means editing shared code (§7.5).
 */
function reaches(doc: UmlDocument, fromId: string, targetId: string): boolean {
  const pending = [fromId]
  const seen = new Set<string>()

  while (pending.length > 0) {
    const current = pending.pop()
    if (current === undefined || seen.has(current)) continue
    if (current === targetId) return true
    seen.add(current)

    for (const edge of Object.values(doc.edges)) {
      if (edge.kind === GENERALIZATION_KIND && edge.source === current) {
        pending.push(edge.target)
      }
    }
  }

  return false
}

export const generalizationSpec: RelationSpec = {
  kind: GENERALIZATION_KIND,
  label: 'Generalización',
  icon: Triangle,

  line: 'solid',
  sourceMarker: null,
  targetMarker: 'triangleHollow',

  // A generalization has no ends to adorn: no multiplicity, no roles, no name.
  supports: {
    multiplicity: false,
    roles: false,
    name: false,
    navigability: false,
  },

  isValidConnection: (source: UmlNode, target: UmlNode, doc: UmlDocument) => {
    if (source.id === target.id) return false

    // Inheriting from the interface side is a realization, not a generalization.
    if (source.kind !== target.kind) return false

    return !reaches(doc, target.id, source.id)
  },

  connectionHint:
    'Una generalización une dos elementos del mismo tipo (clase con clase, interfaz con ' +
    'interfaz) y no admite ciclos. De una clase hacia una interfaz, usá realización.',

  metamodelNote:
    'Generalization con specific = origen y general = destino.',
}
