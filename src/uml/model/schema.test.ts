import { describe, expect, it } from 'vitest'

import { createDocument, createEdge, createNode, createProperty } from '@/uml/model/factories'
import { createSampleDocument } from '@/uml/model/sampleDocument'
import { SCHEMA_VERSION, umlDocumentSchema } from '@/uml/model/schema'

function messagesOf(document: unknown): string[] {
  const result = umlDocumentSchema.safeParse(document)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('umlDocumentSchema', () => {
  it('accepts an empty document', () => {
    expect(umlDocumentSchema.safeParse(createDocument()).success).toBe(true)
  })

  it('accepts the sample document', () => {
    expect(messagesOf(createSampleDocument())).toEqual([])
  })

  it('rejects a schemaVersion other than the current one', () => {
    const doc = { ...createDocument(), schemaVersion: SCHEMA_VERSION + 1 }

    expect(messagesOf(doc).join(' ')).toContain(`Se esperaba schemaVersion ${SCHEMA_VERSION}`)
  })

  it('rejects a document that is not a class model', () => {
    const doc = { ...createDocument(), kind: 'uml-sequence-model' }

    expect(umlDocumentSchema.safeParse(doc).success).toBe(false)
  })

  // §5.4.1
  it('rejects an edge pointing at a node that does not exist', () => {
    const doc = createSampleDocument()
    doc.edges.e_broken = createEdge({ id: 'e_broken', kind: 'association', source: 'n_student', target: 'n_ghost' })

    expect(messagesOf(doc).join(' ')).toContain('referencia un nodo inexistente "n_ghost"')
  })

  it('rejects an edge whose endpoints live in another diagram', () => {
    const doc = createSampleDocument()
    doc.diagrams.push({ id: 'd_other', name: 'Otro', viewport: { x: 0, y: 0, zoom: 1 } })
    doc.edges.e_cross = createEdge({
      id: 'e_cross',
      kind: 'association',
      diagramId: 'd_other',
      source: 'n_student',
      target: 'n_person',
    })

    expect(messagesOf(doc).join(' ')).toContain('cruza diagramas')
  })

  it('rejects a node pointing at a diagram that does not exist', () => {
    const doc = createSampleDocument()
    doc.nodes.n_student!.diagramId = 'd_ghost'

    expect(messagesOf(doc).join(' ')).toContain('diagrama inexistente')
  })

  // §5.4.2
  it('rejects a parent that is not a package', () => {
    const doc = createSampleDocument()
    doc.nodes.n_student!.parentId = 'n_person'

    expect(messagesOf(doc).join(' ')).toContain('debe ser un paquete')
  })

  it('rejects a containment cycle', () => {
    const doc = createDocument()
    const a = createNode({ id: 'n_a', kind: 'package', position: { x: 0, y: 0 }, compartmentIds: [] })
    const b = createNode({ id: 'n_b', kind: 'package', position: { x: 0, y: 0 }, compartmentIds: [] })
    a.parentId = 'n_b'
    b.parentId = 'n_a'
    doc.nodes.n_a = a
    doc.nodes.n_b = b

    expect(messagesOf(doc).join(' ')).toContain('ciclo de contención')
  })

  // §5.4.3
  it('rejects a repeated id, member ids included', () => {
    const doc = createSampleDocument()
    doc.nodes.n_student!.compartments.attributes!.push(
      createProperty({ id: 'm_code', name: 'otro' }),
    )

    expect(messagesOf(doc).join(' ')).toContain('El id "m_code" está repetido')
  })

  it('rejects a record key that does not match the element id', () => {
    const doc = createSampleDocument()
    const node = doc.nodes.n_student!
    delete doc.nodes.n_student
    doc.nodes.n_wrongKey = node

    expect(messagesOf(doc).join(' ')).toContain('no coincide con el id del nodo')
  })
})
