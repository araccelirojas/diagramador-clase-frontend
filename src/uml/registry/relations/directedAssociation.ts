import { MoveRight } from 'lucide-react'

import { ASSOCIATION_SUPPORTS } from '@/uml/registry/relations/association'
import type { RelationSpec } from '@/uml/registry/types'

export const directedAssociationSpec: RelationSpec = {
  kind: 'directed-association',
  label: 'Asociación dirigida',
  icon: MoveRight,

  line: 'solid',
  sourceMarker: null,
  targetMarker: 'arrowOpen',

  supports: ASSOCIATION_SUPPORTS,

  // The arrow head IS the navigability of the target end.
  defaultEnds: {
    target: { navigable: true },
    source: { navigable: false },
  },

  metamodelNote:
    'Association cuyo memberEnd destino tiene navigableOwnedEnd; el origen no es navegable.',
}
