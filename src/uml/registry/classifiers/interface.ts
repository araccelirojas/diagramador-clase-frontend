import { Circle } from 'lucide-react'

import { STRUCTURAL_COMPARTMENTS } from '@/uml/registry/classifiers/class'
import type { ClassifierSpec } from '@/uml/registry/types'

export const interfaceSpec: ClassifierSpec = {
  kind: 'interface',
  label: 'Interfaz',
  icon: Circle,
  group: 'classifiers',

  defaultKeywords: ['interface'],
  defaultName: 'Interfaz',
  defaultSize: { width: 200, height: null },
  header: 'compartment',

  compartments: STRUCTURAL_COMPARTMENTS,

  // An interface is already abstract by definition; the flag would be noise.
  canBeAbstract: false,
}
