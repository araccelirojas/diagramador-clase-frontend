import { describe, expect, it } from 'vitest'

import { canConnect } from '@/canvas/interaction/connectionRules'
import { createDocument, createEdge, createNode } from '@/uml/model/factories'
import type { UmlDocument } from '@/uml/model/types'
import { RELATION_LIST } from '@/uml/registry'

/**
 * The full matrix of "what may connect to what". This is the file to read when
 * wondering whether a rejected connection is a UML rule or a bug.
 */
function docWith(): UmlDocument {
  const doc = createDocument()

  for (const [id, kind] of [
    ['n_a', 'class'],
    ['n_b', 'class'],
    ['n_i', 'interface'],
    ['n_j', 'interface'],
  ] as const) {
    doc.nodes[id] = createNode({ id, kind, position: { x: 0, y: 0 }, compartmentIds: [] })
  }

  return doc
}

const PAIRS = [
  ['n_a', 'n_b', 'clase -> clase'],
  ['n_a', 'n_i', 'clase -> interfaz'],
  ['n_i', 'n_a', 'interfaz -> clase'],
  ['n_i', 'n_j', 'interfaz -> interfaz'],
] as const

describe('connection matrix', () => {
  const doc = docWith()

  it.each(RELATION_LIST.map((spec) => spec.kind))('%s', (kind) => {
    const results = PAIRS.map(
      ([source, target, label]) => `${label}: ${canConnect(doc, kind, source, target) ? 'sí' : 'no'}`,
    )

    // Printed so the matrix is visible in the test output, not just asserted.
    console.info(`${kind.padEnd(22)} ${results.join(' | ')}`)
    expect(results).toHaveLength(4)
  })
})

describe('association-like relations connect any two classifiers', () => {
  const doc = docWith()

  for (const kind of ['association', 'directed-association', 'aggregation', 'composition']) {
    it(`${kind} connects classes and interfaces alike`, () => {
      expect(canConnect(doc, kind, 'n_a', 'n_b')).toBe(true)
      expect(canConnect(doc, kind, 'n_a', 'n_i')).toBe(true)
      expect(canConnect(doc, kind, 'n_i', 'n_j')).toBe(true)
    })
  }
})

describe('generalization: same kind on both ends (UML 2.5)', () => {
  const doc = docWith()

  it('accepts class to class', () => {
    expect(canConnect(doc, 'generalization', 'n_a', 'n_b')).toBe(true)
  })

  it('accepts interface to interface', () => {
    expect(canConnect(doc, 'generalization', 'n_i', 'n_j')).toBe(true)
  })

  it('rejects class to interface: that is a realization', () => {
    expect(canConnect(doc, 'generalization', 'n_a', 'n_i')).toBe(false)
  })

  it('rejects a cycle', () => {
    const withParent = docWith()
    withParent.edges.e_1 = createEdge({
      id: 'e_1',
      kind: 'generalization',
      source: 'n_a',
      target: 'n_b',
    })

    expect(canConnect(withParent, 'generalization', 'n_b', 'n_a')).toBe(false)
  })
})

describe('realization: only towards an interface (UML 2.5)', () => {
  const doc = docWith()

  it('accepts class to interface', () => {
    expect(canConnect(doc, 'realization', 'n_a', 'n_i')).toBe(true)
  })

  it('accepts interface to interface', () => {
    expect(canConnect(doc, 'realization', 'n_i', 'n_j')).toBe(true)
  })

  it('rejects class to class', () => {
    expect(canConnect(doc, 'realization', 'n_a', 'n_b')).toBe(false)
  })
})

describe('rules shared by every relation', () => {
  const doc = docWith()

  /** Una auto-asociación es UML legal: un empleado que supervisa empleados. */
  const CONSIGO_MISMO_PERMITIDO = new Set([
    'association',
    'directed-association',
    'aggregation',
    'composition',
    'association-class',
  ])

  it('permite las relaciones de un elemento consigo mismo que UML admite', () => {
    for (const kind of CONSIGO_MISMO_PERMITIDO) {
      expect(canConnect(doc, kind, 'n_a', 'n_a'), kind).toBe(true)
    }
  })

  it('pero no que algo herede de sí mismo ni se implemente a sí mismo', () => {
    for (const spec of RELATION_LIST) {
      if (CONSIGO_MISMO_PERMITIDO.has(spec.kind)) continue

      expect(canConnect(doc, spec.kind, 'n_a', 'n_a'), spec.kind).toBe(false)
    }
  })

  it('cubre todas las relaciones registradas: una nueva tiene que decidir', () => {
    const decididas = new Set(RELATION_LIST.map((spec) => spec.kind))

    for (const kind of CONSIGO_MISMO_PERMITIDO) {
      expect(decididas.has(kind), `"${kind}" ya no existe en el registry`).toBe(true)
    }
  })

  it('rejects a node that does not exist', () => {
    expect(canConnect(doc, 'association', 'n_a', 'n_ghost')).toBe(false)
  })

  it('rejects crossing diagrams (§5.4.1)', () => {
    const crossing = docWith()
    crossing.diagrams.push({ id: 'd_other', name: 'Otro', viewport: { x: 0, y: 0, zoom: 1 } })
    crossing.nodes.n_b!.diagramId = 'd_other'

    expect(canConnect(crossing, 'association', 'n_a', 'n_b')).toBe(false)
  })
})
