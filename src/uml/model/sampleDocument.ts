import {
  createDocument,
  createEdge,
  createNode,
  createOperation,
  createParameter,
  createProperty,
  MAIN_DIAGRAM_ID,
} from '@/uml/model/factories'
import type { UmlDocument } from '@/uml/model/types'

/**
 * A deterministic document used by the tests (schema, validators and, from
 * block 9 on, the export/import round trip). Every id is fixed on purpose: a
 * round-trip test cannot assert equality against random nanoids.
 */
export function createSampleDocument(): UmlDocument {
  const doc = createDocument({ name: 'Sistema de Matrículas', now: '2026-09-10T14:00:00.000Z' })

  const student = createNode({
    id: 'n_student',
    kind: 'class',
    name: 'Estudiante',
    position: { x: 0, y: 0 },
    compartmentIds: ['attributes', 'operations'],
  })
  student.compartments.attributes = [
    createProperty({ id: 'm_code', name: 'codigo', type: 'String', visibility: '-' }),
    createProperty({
      id: 'm_grades',
      name: 'notas',
      type: 'Nota',
      visibility: '-',
      multiplicity: '0..*',
      isOrdered: true,
      isUnique: false,
    }),
  ]
  student.compartments.operations = [
    createOperation({
      id: 'm_enroll',
      name: 'matricular',
      returnType: 'boolean',
      parameters: [createParameter({ id: 'p_course', name: 'curso', type: 'Curso' })],
    }),
  ]

  const person = createNode({
    id: 'n_person',
    kind: 'class',
    name: 'Persona',
    isAbstract: true,
    position: { x: 0, y: -200 },
    size: { width: 220, height: 140 },
    compartmentIds: ['attributes', 'operations'],
  })
  person.compartments.attributes = [
    createProperty({ id: 'm_name', name: 'nombre', type: 'String', visibility: '#' }),
  ]

  const inheritance = createEdge({
    id: 'e_inherits',
    kind: 'generalization',
    source: 'n_student',
    target: 'n_person',
  })

  doc.nodes[student.id] = student
  doc.nodes[person.id] = person
  doc.edges[inheritance.id] = inheritance
  doc.diagrams[0] = { id: MAIN_DIAGRAM_ID, name: 'Modelo de dominio', viewport: { x: 0, y: 0, zoom: 1 } }

  return doc
}
