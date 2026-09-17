import { TriangleDashed } from 'lucide-react'

import type { UmlNode } from '@/uml/model/types'
import type { RelationSpec } from '@/uml/registry/types'

const INTERFACE_KIND = 'interface'

export const realizationSpec: RelationSpec = {
  kind: 'realization',
  label: 'Realización',
  icon: TriangleDashed,

  line: 'dashed',
  sourceMarker: null,
  targetMarker: 'triangleHollow',

  supports: {
    multiplicity: false,
    roles: false,
    name: false,
    navigability: false,
  },

  // A realization goes from a classifier to the interface it implements.
  isValidConnection: (source: UmlNode, target: UmlNode) =>
    source.id !== target.id && target.kind === INTERFACE_KIND,

  connectionHint:
    'Una realización va desde un clasificador hacia una interfaz. Entre dos clases, lo que ' +
    'corresponde es una generalización.',

  metamodelNote:
    'InterfaceRealization con implementingClassifier = origen y contract = destino.',
}
