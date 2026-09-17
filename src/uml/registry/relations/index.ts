import { aggregationSpec } from '@/uml/registry/relations/aggregation'
import { associationSpec } from '@/uml/registry/relations/association'
import { compositionSpec } from '@/uml/registry/relations/composition'
import { directedAssociationSpec } from '@/uml/registry/relations/directedAssociation'
import { generalizationSpec } from '@/uml/registry/relations/generalization'
import { realizationSpec } from '@/uml/registry/relations/realization'
import type { RelationSpec } from '@/uml/registry/types'

/** Order here is the order the palette shows them in. */
const SPECS: RelationSpec[] = [
  associationSpec,
  directedAssociationSpec,
  aggregationSpec,
  compositionSpec,
  generalizationSpec,
  realizationSpec,
]

export const RELATIONS: Record<string, RelationSpec> = Object.fromEntries(
  SPECS.map((spec) => [spec.kind, spec]),
)

export const RELATION_LIST: readonly RelationSpec[] = SPECS

export function getRelation(kind: string): RelationSpec {
  const spec = RELATIONS[kind]

  if (!spec) {
    throw new Error(`No hay una relación registrada con el kind "${kind}".`)
  }

  return spec
}

export const hasRelation = (kind: string): boolean => RELATIONS[kind] !== undefined
