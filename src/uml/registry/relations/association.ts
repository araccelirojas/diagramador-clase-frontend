import { Minus } from 'lucide-react'

import type { RelationSpec, RelationSupports } from '@/uml/registry/types'

/** Every association-like relation carries the full set of end adornments. */
export const ASSOCIATION_SUPPORTS: RelationSupports = {
  multiplicity: true,
  roles: true,
  name: true,
  navigability: true,
}

export const associationSpec: RelationSpec = {
  kind: 'association',
  label: 'Asociación',
  icon: Minus,

  line: 'solid',
  sourceMarker: null,
  targetMarker: null,

  supports: ASSOCIATION_SUPPORTS,

  metamodelNote:
    'Association con dos memberEnds y aggregation = none en ambos extremos.',
}
