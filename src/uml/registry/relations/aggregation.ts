import { Diamond } from 'lucide-react'

import { ASSOCIATION_SUPPORTS } from '@/uml/registry/relations/association'
import type { RelationSpec } from '@/uml/registry/types'

export const aggregationSpec: RelationSpec = {
  kind: 'aggregation',
  label: 'Agregación',
  icon: Diamond,

  line: 'solid',
  // The hollow diamond sits on the "whole", which is the source end.
  sourceMarker: 'diamondHollow',
  targetMarker: null,

  supports: ASSOCIATION_SUPPORTS,

  metamodelNote:
    'No es un tipo de relación en UML 2.5: es una Association cuyo memberEnd del lado del ' +
    'todo (origen) tiene aggregation = shared. El exportador debe traducirlo así.',
}
