import { useCallback } from 'react'

import { addMember } from '@/state/commands'
import { useDiagramStore } from '@/state/useDiagramStore'
import { createMember } from '@/uml/model/factories'
import type { Member, MemberKind } from '@/uml/model/types'
import { getClassifier, MEMBERS } from '@/uml/registry'

/**
 * Adds a member to a classifier from the palette.
 *
 * Which compartment receives it is decided by the classifier's spec: the tool
 * carries a member kind, and the spec says which of its compartments holds that
 * kind. So dropping an "Atributo" on a class lands in `attributes` without this
 * hook ever naming that compartment.
 */
export function useAddMember() {
  return useCallback((nodeId: string, memberKind: MemberKind): Member | null => {
    const state = useDiagramStore.getState()
    const node = state.doc.nodes[nodeId]
    if (!node) return null

    const spec = getClassifier(node.kind)
    const compartment = spec.compartments.find((candidate) => candidate.memberKind === memberKind)

    if (!compartment) {
      state.setNotice(
        `"${spec.label}" no tiene un compartimento para ${MEMBERS[memberKind].label.toLowerCase()}.`,
      )
      return null
    }

    const member = createMember(memberKind)
    state.dispatch(addMember({ nodeId, compartmentId: compartment.id, member }))
    return member
  }, [])
}
