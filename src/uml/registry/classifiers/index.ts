import { associationClassSpec } from '@/uml/registry/classifiers/associationClass'
import { classSpec } from '@/uml/registry/classifiers/class'
import { interfaceSpec } from '@/uml/registry/classifiers/interface'
import type { ClassifierSpec } from '@/uml/registry/types'

/**
 * Registering a classifier is adding it to this list. Nothing else in the app
 * needs to know it exists: the palette, the node and the inspector read the
 * spec (CLAUDE.md §7.4).
 */
const SPECS: ClassifierSpec[] = [classSpec, interfaceSpec, associationClassSpec]

export const CLASSIFIERS: Record<string, ClassifierSpec> = Object.fromEntries(
  SPECS.map((spec) => [spec.kind, spec]),
)

export const CLASSIFIER_LIST: readonly ClassifierSpec[] = SPECS

/** Throws instead of returning undefined: an unknown kind is a bug, not a state. */
export function getClassifier(kind: string): ClassifierSpec {
  const spec = CLASSIFIERS[kind]

  if (!spec) {
    throw new Error(`No hay un clasificador registrado con el kind "${kind}".`)
  }

  return spec
}

export const hasClassifier = (kind: string): boolean => CLASSIFIERS[kind] !== undefined

/** Compartment ids a new node of this kind starts with. */
export const compartmentIdsOf = (spec: ClassifierSpec): string[] =>
  spec.compartments.map((compartment) => compartment.id)
