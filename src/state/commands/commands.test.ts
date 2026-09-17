import { produce } from 'immer'
import { describe, expect, it } from 'vitest'

import {
  addEdge,
  addMember,
  addNode,
  applyCommand,
  moveMember,
  moveNodes,
  removeMember,
  removeNodes,
  renameNode,
  setEdgeEnd,
  setNodeParent,
  updateMember,
  type Command,
} from '@/state/commands'
import { createEdge, createNode, createProperty } from '@/uml/model/factories'
import { createSampleDocument } from '@/uml/model/sampleDocument'
import { umlDocumentSchema } from '@/uml/model/schema'
import type { UmlDocument } from '@/uml/model/types'

/** Commands are pure functions over a draft: this is the whole test harness. */
function apply(doc: UmlDocument, ...commands: Command[]): UmlDocument {
  return commands.reduce(
    (current, command) => produce(current, (draft) => applyCommand(draft, command)),
    doc,
  )
}

const expectValid = (doc: UmlDocument): void => {
  const result = umlDocumentSchema.safeParse(doc)
  expect(result.success ? [] : result.error.issues.map((issue) => issue.message)).toEqual([])
}

describe('node commands', () => {
  it('adds a node', () => {
    const node = createNode({ id: 'n_new', kind: 'class', position: { x: 10, y: 20 }, compartmentIds: ['attributes'] })
    const doc = apply(createSampleDocument(), addNode({ node }))

    expect(doc.nodes.n_new?.name).toBe('Clase')
    expectValid(doc)
  })

  // §5.4.4
  it('cascades to incident edges when deleting a node', () => {
    const doc = apply(createSampleDocument(), removeNodes({ ids: ['n_person'] }))

    expect(doc.nodes.n_person).toBeUndefined()
    expect(doc.edges.e_inherits).toBeUndefined()
    expectValid(doc)
  })

  it('un-parents the children of a deleted package', () => {
    const base = createSampleDocument()
    const pkg = createNode({ id: 'n_pkg', kind: 'package', position: { x: 0, y: 0 }, compartmentIds: [] })

    const doc = apply(
      base,
      addNode({ node: pkg }),
      setNodeParent({ id: 'n_student', parentId: 'n_pkg' }),
      removeNodes({ ids: ['n_pkg'] }),
    )

    expect(doc.nodes.n_student?.parentId).toBeNull()
    expectValid(doc)
  })

  it('moves several nodes by the same delta', () => {
    const doc = apply(
      createSampleDocument(),
      moveNodes({ ids: ['n_student', 'n_person'], delta: { x: 15, y: -5 } }),
    )

    expect(doc.nodes.n_student?.position).toEqual({ x: 15, y: -5 })
    expect(doc.nodes.n_person?.position).toEqual({ x: 15, y: -205 })
  })

  it('ignores ids that no longer exist instead of throwing', () => {
    const doc = apply(createSampleDocument(), moveNodes({ ids: ['n_ghost'], delta: { x: 1, y: 1 } }))

    expect(doc.nodes.n_ghost).toBeUndefined()
  })

  it('renames without replacing the node', () => {
    const base = createSampleDocument()
    const doc = apply(base, renameNode({ id: 'n_student', name: 'Alumno' }))

    expect(doc.nodes.n_student?.name).toBe('Alumno')
    // §11.4: a fine-grained command leaves everything else untouched.
    expect(doc.nodes.n_student?.compartments).toBe(base.nodes.n_student?.compartments)
  })

  it('refuses a containment cycle', () => {
    const base = createSampleDocument()
    const a = createNode({ id: 'n_p1', kind: 'package', position: { x: 0, y: 0 }, compartmentIds: [] })
    const b = createNode({ id: 'n_p2', kind: 'package', position: { x: 0, y: 0 }, compartmentIds: [] })

    const doc = apply(
      base,
      addNode({ node: a }),
      addNode({ node: b }),
      setNodeParent({ id: 'n_p2', parentId: 'n_p1' }),
      setNodeParent({ id: 'n_p1', parentId: 'n_p2' }),
    )

    expect(doc.nodes.n_p1?.parentId).toBeNull()
    expectValid(doc)
  })
})

describe('edge commands', () => {
  it('refuses an edge whose endpoint does not exist (§5.4.1)', () => {
    const doc = apply(
      createSampleDocument(),
      addEdge({ edge: createEdge({ id: 'e_bad', kind: 'association', source: 'n_student', target: 'n_ghost' }) }),
    )

    expect(doc.edges.e_bad).toBeUndefined()
    expectValid(doc)
  })

  it('patches one field of one end only', () => {
    const base = createSampleDocument()
    const doc = apply(base, setEdgeEnd({ id: 'e_inherits', side: 'target', patch: { multiplicity: '1' } }))

    expect(doc.edges.e_inherits?.ends.target.multiplicity).toBe('1')
    expect(doc.edges.e_inherits?.ends.target.role).toBeNull()
    expect(doc.edges.e_inherits?.ends.source).toEqual(base.edges.e_inherits?.ends.source)
  })
})

describe('member commands', () => {
  it('appends a member to the compartment declared by the spec', () => {
    const doc = apply(
      createSampleDocument(),
      addMember({
        nodeId: 'n_person',
        compartmentId: 'operations',
        member: createProperty({ id: 'm_extra', name: 'extra' }),
      }),
    )

    expect(doc.nodes.n_person?.compartments.operations?.map((member) => member.id)).toEqual(['m_extra'])
    expectValid(doc)
  })

  it('inserts at a given index', () => {
    const doc = apply(
      createSampleDocument(),
      addMember({
        nodeId: 'n_student',
        compartmentId: 'attributes',
        member: createProperty({ id: 'm_first', name: 'primero' }),
        index: 0,
      }),
    )

    expect(doc.nodes.n_student?.compartments.attributes?.[0]?.id).toBe('m_first')
  })

  it('reorders inside the compartment', () => {
    const doc = apply(
      createSampleDocument(),
      moveMember({ nodeId: 'n_student', compartmentId: 'attributes', memberId: 'm_code', toIndex: 1 }),
    )

    expect(doc.nodes.n_student?.compartments.attributes?.map((member) => member.id)).toEqual([
      'm_grades',
      'm_code',
    ])
  })

  it('patches a member without touching its siblings', () => {
    const base = createSampleDocument()
    const doc = apply(
      base,
      updateMember({
        nodeId: 'n_student',
        compartmentId: 'attributes',
        memberId: 'm_code',
        patch: { kind: 'property', type: 'UUID' },
      }),
    )

    const [first, second] = doc.nodes.n_student?.compartments.attributes ?? []
    expect(first?.kind === 'property' && first.type).toBe('UUID')
    expect(second).toBe(base.nodes.n_student?.compartments.attributes?.[1])
  })

  it('removes a member', () => {
    const doc = apply(
      createSampleDocument(),
      removeMember({ nodeId: 'n_student', compartmentId: 'attributes', memberId: 'm_code' }),
    )

    expect(doc.nodes.n_student?.compartments.attributes?.map((member) => member.id)).toEqual(['m_grades'])
    expectValid(doc)
  })
})

describe('applyCommand', () => {
  it('rejects an unknown command instead of silently doing nothing', () => {
    expect(() =>
      apply(createSampleDocument(), { type: 'node.explode', payload: {} }),
    ).toThrow(/Comando desconocido/)
  })

  it('keeps every payload JSON serializable (§6.2)', () => {
    const commands: Command[] = [
      addNode({ node: createNode({ id: 'n_x', kind: 'class', position: { x: 1, y: 2 }, compartmentIds: [] }) }),
      moveNodes({ ids: ['n_x'], delta: { x: 1, y: 1 } }),
      renameNode({ id: 'n_x', name: 'X' }),
      setEdgeEnd({ id: 'e_inherits', side: 'source', patch: { navigable: true } }),
    ]

    for (const command of commands) {
      expect(JSON.parse(JSON.stringify(command))).toEqual(command)
    }
  })
})
