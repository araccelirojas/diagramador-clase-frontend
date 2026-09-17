import { Gem } from 'lucide-react'

import { ASSOCIATION_SUPPORTS } from '@/uml/registry/relations/association'
import type { RelationSpec } from '@/uml/registry/types'

export const compositionSpec: RelationSpec = {
  kind: 'composition',
  label: 'Composición',
  icon: Gem,

  line: 'solid',
  sourceMarker: 'diamondFilled',
  targetMarker: null,

  supports: ASSOCIATION_SUPPORTS,

  // A composed part belongs to exactly one whole.
  defaultEnds: {
    source: { multiplicity: '1' },
  },

  metamodelNote:
    'No es un tipo de relación en UML 2.5: es una Association cuyo memberEnd del lado del ' +
    'todo (origen) tiene aggregation = composite. El exportador debe traducirlo así.',
}
