import { Square, SquareDashed } from 'lucide-react'

import type { ClassifierSpec, CompartmentSpec } from '@/uml/registry/types'

/** Shared by every classifier drawn as a box of attributes and operations. */
export const STRUCTURAL_COMPARTMENTS: CompartmentSpec[] = [
  { id: 'attributes', label: 'Atributos', memberKind: 'property', separator: 'line' },
  { id: 'operations', label: 'Operaciones', memberKind: 'operation', separator: 'line' },
]

export const classSpec: ClassifierSpec = {
  kind: 'class',
  label: 'Clase',
  icon: Square,
  group: 'classifiers',

  defaultName: 'Clase',
  defaultSize: { width: 200, height: null },
  header: 'compartment',

  compartments: STRUCTURAL_COMPARTMENTS,

  canBeAbstract: true,

  // An abstract class is this same kind with isAbstract: true, never a kind of
  // its own: the model already says it (§5.2) and two truths would diverge.
  variants: [
    {
      id: 'abstract-class',
      label: 'Clase abstracta',
      icon: SquareDashed,
      defaults: { name: 'ClaseAbstracta', isAbstract: true },
    },
  ],
}
