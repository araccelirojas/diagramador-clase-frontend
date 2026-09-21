import { describe, expect, it } from 'vitest'

import { removeEdges, removeNodes } from '@/state/commands'
import { useDiagramStore } from '@/state/useDiagramStore'
import { createEdge, createNode } from '@/uml/model/factories'
import { umlDocumentSchema } from '@/uml/model/schema'
import type { UmlDocument } from '@/uml/model/types'
import { validateDocument } from '@/uml/model/validators'
import { createSampleDocument } from '@/uml/model/sampleDocument'

/**
 * The association class is the first element whose existence depends on another
 * element, so the rules that matter are about what happens when the other one
 * goes away.
 */

const store = useDiagramStore

/** Estudiante *—* Curso with its association class hanging off the relation. */
function documentWithAssociationClass(
  multiplicities: { source: string | null; target: string | null } = {
    source: '1..*',
    target: '0..*',
  },
): UmlDocument {
  const doc = createSampleDocument()

  const curso = createNode({
    id: 'n_curso',
    kind: 'class',
    name: 'Curso',
    position: { x: 400, y: 0 },
    compartmentIds: ['attributes', 'operations'],
  })
  doc.nodes[curso.id] = curso

  const association = createEdge({
    id: 'e_cursa',
    kind: 'association',
    source: 'n_student',
    target: 'n_curso',
    ends: {
      source: { multiplicity: multiplicities.source },
      target: { multiplicity: multiplicities.target },
    },
  })
  doc.edges[association.id] = association

  const matricula = createNode({
    id: 'n_matricula',
    kind: 'association-class',
    name: 'Matricula',
    position: { x: 200, y: 300 },
    compartmentIds: ['attributes', 'operations'],
    associationId: 'e_cursa',
  })
  doc.nodes[matricula.id] = matricula

  return doc
}

describe('the association class in the document', () => {
  it('is a valid document', () => {
    expect(umlDocumentSchema.safeParse(documentWithAssociationClass()).success).toBe(true)
  })

  it('is rejected when it points at a relation that does not exist', () => {
    const doc = documentWithAssociationClass()
    delete doc.edges.e_cursa

    const result = umlDocumentSchema.safeParse(doc)

    expect(result.success).toBe(false)
    if (result.success) return

    expect(result.error.issues.some((issue) => issue.path.includes('associationId'))).toBe(true)
  })
})

describe('cascade deletion', () => {
  it('deleting the relation deletes its association class', () => {
    store.getState().replaceDocument(documentWithAssociationClass())
    store.getState().dispatch(removeEdges({ ids: ['e_cursa'] }))

    const doc = store.getState().doc

    // Leaving it behind would be a box attached to nothing, and the schema
    // would refuse to reopen the document.
    expect(doc.nodes.n_matricula).toBeUndefined()
    expect(umlDocumentSchema.safeParse(doc).success).toBe(true)
  })

  it('deleting a class at one end takes the relation and its class with it', () => {
    store.getState().replaceDocument(documentWithAssociationClass())
    store.getState().dispatch(removeNodes({ ids: ['n_curso'] }))

    const doc = store.getState().doc

    expect(doc.edges.e_cursa).toBeUndefined()
    expect(doc.nodes.n_matricula).toBeUndefined()
    expect(umlDocumentSchema.safeParse(doc).success).toBe(true)
  })

  it('deleting the association class deletes its relation too', () => {
    store.getState().replaceDocument(documentWithAssociationClass())
    store.getState().dispatch(removeNodes({ ids: ['n_matricula'] }))

    const doc = store.getState().doc

    // They are one UML element (§11.5): born together by one gesture, gone
    // together. Leaving the line behind would leave an association nobody asked
    // for, with the many-to-many defaults of a tool the user has undone.
    expect(doc.edges.e_cursa).toBeUndefined()

    // The two classes it joined are untouched.
    expect(doc.nodes.n_student).toBeDefined()
    expect(doc.nodes.n_curso).toBeDefined()
    expect(umlDocumentSchema.safeParse(doc).success).toBe(true)
  })
})

describe('the spec rule', () => {
  it('says nothing about a many-to-many relation, which is the normal case', () => {
    const issues = validateDocument(documentWithAssociationClass())

    expect(issues.filter((issue) => issue.code.startsWith('association-class'))).toEqual([])
  })

  it('warns — never blocks — on a relation that is not many-to-many', () => {
    const doc = documentWithAssociationClass({ source: '1', target: '0..*' })
    const issues = validateDocument(doc)
    const [issue] = issues.filter((one) => one.code === 'association-class.not-many-to-many')

    expect(issue).toBeDefined()
    // §9: warn, do not block. An unusual model is still a legal one.
    expect(issue?.severity).toBe('warning')
    expect(umlDocumentSchema.safeParse(doc).success).toBe(true)
  })

  it('reports as an error a class of its kind attached to nothing', () => {
    const doc = documentWithAssociationClass()
    const matricula = doc.nodes.n_matricula
    if (matricula) matricula.associationId = null

    const issues = validateDocument(doc)

    expect(issues.some((issue) => issue.code === 'association-class.detached')).toBe(true)
  })
})
