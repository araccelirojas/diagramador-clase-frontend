import { Combine } from 'lucide-react'

import { STRUCTURAL_COMPARTMENTS } from '@/uml/registry/classifiers/class'
import type { ClassifierSpec } from '@/uml/registry/types'
import type { Issue, UmlDocument, UmlNode } from '@/uml/model/types'

/**
 * Association class: the box that carries the attributes belonging to a
 * relation rather than to either of its ends. The classic case is a
 * many-to-many association — Estudiante *—* Curso with a `nota` and a
 * `fechaInscripcion` that are neither the student's nor the course's.
 *
 * Notation: an ordinary class box joined to the relation by a DASHED line, with
 * no arrow head on either side.
 *
 * Metamodel note for the future exporter: in UML 2.5 this is a single element,
 * `AssociationClass`, which is at once an Association and a Class. Here it is a
 * node holding `associationId` (§5.2) because the document keeps nodes and
 * edges in separate collections. The exporter has to fuse them back into one.
 */

/** '*', '0..*', '1..*', 'n..*' — anything with an unbounded upper limit. */
function isMany(multiplicity: string | null): boolean {
  if (multiplicity === null) return false

  const upper = multiplicity.includes('..')
    ? (multiplicity.split('..')[1] ?? '').trim()
    : multiplicity.trim()

  return upper === '*' || (Number(upper) > 1 && !Number.isNaN(Number(upper)))
}

export const associationClassSpec: ClassifierSpec = {
  kind: 'association-class',
  label: 'Clase de asociación',
  icon: Combine,
  group: 'classifiers',

  defaultName: 'ClaseAsociacion',
  defaultSize: { width: 200, height: null },
  header: 'compartment',

  compartments: STRUCTURAL_COMPARTMENTS,

  canBeAbstract: true,

  // No palette tool of its own: it is born with its relation (see the
  // `association-class` RelationSpec, which declares `classifierKind`).
  attachedToRelation: true,

  /**
   * Warns, never blocks (§9). An association class on a one-to-many relation is
   * unusual but legal UML; on a many-to-many it is the whole point. Refusing it
   * would be wrong, and staying silent would let a modelling mistake through.
   */
  validate: (node: UmlNode, doc: UmlDocument): Issue[] => {
    if (node.associationId === null) {
      return [
        {
          code: 'association-class.detached',
          severity: 'error',
          message: `"${node.name}" es una clase de asociación pero no está unida a ninguna relación.`,
          target: { kind: 'node', id: node.id },
        },
      ]
    }

    const association = doc.edges[node.associationId]
    if (!association) return []

    const manyToMany = isMany(association.ends.source.multiplicity) &&
      isMany(association.ends.target.multiplicity)

    if (manyToMany) return []

    return [
      {
        code: 'association-class.not-many-to-many',
        severity: 'warning',
        message:
          `"${node.name}" cuelga de una relación que no es de muchos a muchos. ` +
          'Es válido, pero suele indicar que los atributos pertenecen a una de las dos clases.',
        target: { kind: 'node', id: node.id },
      },
    ]
  },
}
