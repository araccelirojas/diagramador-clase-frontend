import { describe, expect, it } from 'vitest'

import { createDocument, createNode, createProperty } from '@/uml/model/factories'
import { createSampleDocument } from '@/uml/model/sampleDocument'
import { validateDocument } from '@/uml/model/validators'

const codesOf = (issues: ReturnType<typeof validateDocument>): string[] =>
  issues.map((issue) => issue.code)

describe('validateDocument', () => {
  it('finds nothing wrong in an empty document', () => {
    expect(validateDocument(createDocument())).toEqual([])
  })

  it('finds nothing wrong in the sample document', () => {
    expect(validateDocument(createSampleDocument())).toEqual([])
  })

  it('warns about a classifier with no name', () => {
    const doc = createDocument()
    doc.nodes.n_a = createNode({ id: 'n_a', kind: 'class', name: '', position: { x: 0, y: 0 }, compartmentIds: [] })

    expect(codesOf(validateDocument(doc))).toEqual(['node.name.empty'])
  })

  it('warns on both classifiers sharing a name in the same diagram', () => {
    const doc = createDocument()
    doc.nodes.n_a = createNode({ id: 'n_a', kind: 'class', name: 'Curso', position: { x: 0, y: 0 }, compartmentIds: [] })
    doc.nodes.n_b = createNode({ id: 'n_b', kind: 'class', name: ' curso ', position: { x: 0, y: 0 }, compartmentIds: [] })

    expect(codesOf(validateDocument(doc))).toEqual([
      'node.name.duplicated',
      'node.name.duplicated',
    ])
  })

  it('warns about a repeated member inside a compartment', () => {
    const doc = createSampleDocument()
    doc.nodes.n_student!.compartments.attributes!.push(
      createProperty({ id: 'm_dup', name: 'codigo', type: 'String' }),
    )

    expect(codesOf(validateDocument(doc))).toEqual(['member.name.duplicated'])
  })

  it('reports a dangling relation as an error', () => {
    const doc = createSampleDocument()
    delete doc.nodes.n_person

    const issues = validateDocument(doc)

    expect(codesOf(issues)).toContain('edge.endpoint.missing')
    expect(issues.every((issue) => issue.severity === 'error')).toBe(true)
  })

  it('never blocks: every issue is data, not an exception', () => {
    const doc = createSampleDocument()
    doc.nodes.n_student!.name = ''

    expect(() => validateDocument(doc)).not.toThrow()
  })
})
