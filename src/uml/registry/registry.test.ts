import { describe, expect, it } from 'vitest'

import { createEdge, createNode } from '@/uml/model/factories'
import { createSampleDocument } from '@/uml/model/sampleDocument'
import { CLASSIFIER_LIST, RELATION_LIST, getClassifier, getRelation } from '@/uml/registry'

const MEMBER_KINDS = ['property', 'operation', 'literal']

describe('classifier registry', () => {
  it('has no duplicated kinds', () => {
    const kinds = CLASSIFIER_LIST.map((spec) => spec.kind)

    expect(new Set(kinds).size).toBe(kinds.length)
  })

  it('declares well-formed compartments', () => {
    for (const spec of CLASSIFIER_LIST) {
      const ids = spec.compartments.map((compartment) => compartment.id)

      expect(new Set(ids).size, `${spec.kind} repite un compartimento`).toBe(ids.length)

      for (const compartment of spec.compartments) {
        expect(MEMBER_KINDS).toContain(compartment.memberKind)
        expect(compartment.label.length).toBeGreaterThan(0)
      }
    }
  })

  it('declares a default size and name for every kind', () => {
    for (const spec of CLASSIFIER_LIST) {
      expect(spec.defaultSize.width).toBeGreaterThan(0)
      expect(spec.defaultName.length).toBeGreaterThan(0)
    }
  })

  it('throws on an unknown kind instead of returning undefined', () => {
    expect(() => getClassifier('unicornio')).toThrow(/No hay un clasificador/)
  })
})

describe('relation registry', () => {
  it('has no duplicated kinds', () => {
    const kinds = RELATION_LIST.map((spec) => spec.kind)

    expect(new Set(kinds).size).toBe(kinds.length)
  })

  it('documents how each one maps onto the UML 2.5 metamodel', () => {
    for (const spec of RELATION_LIST) {
      expect(spec.metamodelNote, `${spec.kind} no explica su traducción`).toBeTruthy()
    }
  })

  it('covers the six relations of phase 1 plus the association class', () => {
    expect(RELATION_LIST.map((spec) => spec.kind)).toEqual([
      'association',
      'directed-association',
      'aggregation',
      'composition',
      'generalization',
      'realization',
      'association-class',
    ])
  })

  it('the association class is the one relation that also creates a classifier', () => {
    const withClassifier = RELATION_LIST.filter((spec) => spec.classifierKind !== undefined)

    expect(withClassifier.map((spec) => spec.kind)).toEqual(['association-class'])
    // The kind it names has to be registered, or drawing it would throw.
    expect(() => getClassifier(withClassifier[0]?.classifierKind ?? '')).not.toThrow()
  })

  it('a classifier that belongs to a relation has no palette tool of its own', () => {
    for (const spec of CLASSIFIER_LIST) {
      if (spec.attachedToRelation !== true) continue

      const creator = RELATION_LIST.find((relation) => relation.classifierKind === spec.kind)

      // Otherwise it would be unreachable: hidden from the palette and created
      // by nobody.
      expect(creator, `nada crea "${spec.kind}"`).toBeDefined()
    }
  })

  it('throws on an unknown kind', () => {
    expect(() => getRelation('telepatia')).toThrow(/No hay una relación/)
  })
})

describe('generalization rules', () => {
  const spec = getRelation('generalization')
  const doc = createSampleDocument()
  const student = doc.nodes.n_student!
  const person = doc.nodes.n_person!

  it('refuses a self reference', () => {
    expect(spec.isValidConnection?.(student, student, doc)).toBe(false)
  })

  it('refuses closing a cycle', () => {
    // The sample already has Estudiante --|> Persona.
    expect(spec.isValidConnection?.(person, student, doc)).toBe(false)
  })

  it('refuses inheriting across different classifier kinds', () => {
    const anInterface = createNode({
      id: 'n_iface',
      kind: 'interface',
      position: { x: 0, y: 0 },
      compartmentIds: [],
    })

    expect(spec.isValidConnection?.(student, anInterface, doc)).toBe(false)
  })

  it('accepts a new ancestor', () => {
    const other = createNode({ id: 'n_other', kind: 'class', position: { x: 0, y: 0 }, compartmentIds: [] })

    expect(spec.isValidConnection?.(student, other, doc)).toBe(true)
  })

  it('detects a cycle two levels deep', () => {
    const deep = createSampleDocument()
    const employee = createNode({ id: 'n_emp', kind: 'class', position: { x: 0, y: 0 }, compartmentIds: [] })
    deep.nodes.n_emp = employee
    deep.edges.e_emp = createEdge({
      id: 'e_emp',
      kind: 'generalization',
      source: 'n_emp',
      target: 'n_student',
    })

    // Persona --|> Empleado would close Empleado -> Estudiante -> Persona.
    expect(spec.isValidConnection?.(deep.nodes.n_person!, employee, deep)).toBe(false)
  })
})

describe('realization rules', () => {
  const spec = getRelation('realization')
  const doc = createSampleDocument()

  it('only targets an interface', () => {
    const anInterface = createNode({
      id: 'n_iface',
      kind: 'interface',
      position: { x: 0, y: 0 },
      compartmentIds: [],
    })

    expect(spec.isValidConnection?.(doc.nodes.n_student!, anInterface, doc)).toBe(true)
    expect(spec.isValidConnection?.(doc.nodes.n_student!, doc.nodes.n_person!, doc)).toBe(false)
  })
})
