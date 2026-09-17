import {
  createDocument,
  createEdge,
  createNode,
  createOperation,
  createParameter,
  createProperty,
} from '@/uml/model/factories'
import type { UmlDocument, UmlNode } from '@/uml/model/types'

/**
 * The reference document for the export/import round trip: every relation of
 * phase 1, both classifiers, members with every flag turned on, a hand-resized
 * node, waypoints, a style and keywords.
 *
 * If `deserialize(serialize(doc))` stops matching this object, the format is
 * wrong and it gets fixed NOW — not once there are diagrams saved in a
 * database (CLAUDE.md §2).
 */

const FIXED_NOW = '2026-09-10T14:00:00.000Z'

function classNode(id: string, name: string, x: number, y: number): UmlNode {
  return createNode({
    id,
    kind: 'class',
    name,
    position: { x, y },
    compartmentIds: ['attributes', 'operations'],
  })
}

export function createFullSampleDocument(): UmlDocument {
  const doc = createDocument({ name: 'Sistema de Matrículas', now: FIXED_NOW })
  doc.diagrams[0] = {
    id: 'd_main',
    name: 'Modelo de dominio',
    viewport: { x: -120, y: 40, zoom: 1.25 },
  }

  // --- Persona: abstract, resized by hand, with a style and a keyword ---
  const persona = classNode('n_persona', 'Persona', 0, 0)
  persona.isAbstract = true
  persona.keywords = ['entity']
  persona.size = { width: 240, height: 160 }
  persona.style = { fill: '#fefce8', stroke: '#a16207' }
  persona.z = 2
  persona.compartments.attributes = [
    createProperty({ id: 'm_nombre', name: 'nombre', type: 'String', visibility: '#' }),
    createProperty({
      id: 'm_edad',
      name: 'edad',
      type: 'int',
      visibility: '-',
      defaultValue: '0',
      isReadOnly: true,
    }),
  ]
  persona.compartments.operations = [
    createOperation({
      id: 'm_saludar',
      name: 'saludar',
      visibility: '+',
      returnType: 'String',
      isAbstract: true,
      isQuery: true,
    }),
  ]

  // --- Estudiante: every property flag, an operation with every parameter direction ---
  const estudiante = classNode('n_estudiante', 'Estudiante', 0, 260)
  estudiante.compartments.attributes = [
    createProperty({
      id: 'm_notas',
      name: 'notas',
      type: 'Nota',
      visibility: '+',
      multiplicity: '0..*',
      defaultValue: '[]',
      isStatic: true,
      isDerived: true,
      isReadOnly: true,
      isOrdered: true,
      isUnique: false,
    }),
  ]
  estudiante.compartments.operations = [
    createOperation({
      id: 'm_matricular',
      name: 'matricular',
      visibility: '#',
      returnType: 'boolean',
      isStatic: true,
      parameters: [
        createParameter({ id: 'p_curso', name: 'curso', type: 'Curso' }),
        createParameter({ id: 'p_ok', name: 'ok', type: 'boolean', direction: 'out' }),
        createParameter({ id: 'p_ctx', name: 'ctx', type: 'Contexto', direction: 'inout' }),
        createParameter({
          id: 'p_ret',
          name: 'resultado',
          type: 'int',
          direction: 'return',
          defaultValue: '0',
        }),
      ],
    }),
  ]

  const curso = classNode('n_curso', 'Curso', 400, 260)
  const inscripcion = classNode('n_inscripcion', 'Inscripcion', 400, 520)
  const direccion = classNode('n_direccion', 'Direccion', -360, 0)

  const pagable = createNode({
    id: 'n_pagable',
    kind: 'interface',
    name: 'Pagable',
    keywords: ['interface'],
    position: { x: -360, y: 260 },
    compartmentIds: ['attributes', 'operations'],
  })
  pagable.compartments.operations = [
    createOperation({ id: 'm_pagar', name: 'pagar', returnType: 'void' }),
  ]

  for (const node of [persona, estudiante, curso, inscripcion, direccion, pagable]) {
    doc.nodes[node.id] = node
  }

  // --- One edge of each of the six relations of phase 1 ---
  const edges = [
    createEdge({
      id: 'e_gen',
      kind: 'generalization',
      source: 'n_estudiante',
      target: 'n_persona',
    }),
    createEdge({
      id: 'e_real',
      kind: 'realization',
      source: 'n_estudiante',
      target: 'n_pagable',
    }),
    createEdge({
      id: 'e_assoc',
      kind: 'association',
      source: 'n_estudiante',
      target: 'n_curso',
      name: 'cursa',
      nameDirection: 'sourceToTarget',
      routing: 'orthogonal',
      waypoints: [{ x: 200, y: 300 }],
      ends: {
        source: { role: 'alumno', multiplicity: '1..*', visibility: '+', isOrdered: true },
        target: { role: 'curso', multiplicity: '0..*', navigable: true, isUnique: false },
      },
    }),
    createEdge({
      id: 'e_dir',
      kind: 'directed-association',
      source: 'n_curso',
      target: 'n_inscripcion',
      ends: { source: { navigable: false }, target: { navigable: true, multiplicity: '0..*' } },
    }),
    createEdge({
      id: 'e_agg',
      kind: 'aggregation',
      source: 'n_curso',
      target: 'n_estudiante',
      routing: 'bezier',
      ends: { source: { multiplicity: '1' }, target: { multiplicity: '0..*' } },
    }),
    createEdge({
      id: 'e_comp',
      kind: 'composition',
      source: 'n_persona',
      target: 'n_direccion',
      ends: { source: { multiplicity: '1' }, target: { multiplicity: '1..*', role: 'domicilio' } },
    }),
  ]

  for (const edge of edges) {
    doc.edges[edge.id] = edge
  }

  return doc
}
