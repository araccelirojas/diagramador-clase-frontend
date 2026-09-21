import { Combine } from 'lucide-react'

import { ASSOCIATION_SUPPORTS } from '@/uml/registry/relations/association'
import type { RelationSpec } from '@/uml/registry/types'

/**
 * The association class, as a TOOL: join two classes and the association is
 * born already carrying its class.
 *
 * It is a relation and not a palette classifier because that is what it is in
 * UML 2.5 — an AssociationClass is an Association that also happens to be a
 * Class — and because it is how people actually draw one: you do not place a
 * box and then look for a line, you connect two classes and the box appears.
 *
 * The line itself is an ordinary association; what makes it an association
 * class is the node that points at it through `associationId`, and the dashed
 * connector the canvas draws between them.
 */
export const associationClassRelationSpec: RelationSpec = {
  kind: 'association-class',
  label: 'Clase de asociación',
  icon: Combine,

  line: 'solid',
  sourceMarker: null,
  targetMarker: null,

  supports: ASSOCIATION_SUPPORTS,

  // Many-to-many by default: that is the case an association class exists for.
  // Anything else is legal UML, so the spec's validate only warns about it.
  defaultEnds: {
    source: { multiplicity: '0..*' },
    target: { multiplicity: '0..*' },
  },

  /** Drawing it also creates the box. */
  classifierKind: 'association-class',

  metamodelNote:
    'UML 2.5 §11.5: AssociationClass es UN elemento que es a la vez Association y Class. ' +
    'Acá son una arista y un nodo unidos por associationId; el exportador debe fusionarlos.',
}
