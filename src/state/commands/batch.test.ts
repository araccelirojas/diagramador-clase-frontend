import { produce } from 'immer'
import { describe, expect, it } from 'vitest'

import {
  addEdge,
  addNode,
  applyBatch,
  applyCommand,
  entitiesToRestore,
  removeNodes,
  renameNode,
  restoreEntities,
  setNodeParent,
  type Command,
} from '@/state/commands'
import { createEdge, createNode } from '@/uml/model/factories'
import { createSampleDocument } from '@/uml/model/sampleDocument'
import { umlDocumentSchema } from '@/uml/model/schema'
import type { UmlDocument } from '@/uml/model/types'

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

const order = createNode({ id: 'n_order', kind: 'class', name: 'Pedido', position: { x: 400, y: 0 }, compartmentIds: ['attributes'] })
const toOrder = createEdge({ id: 'e_order', kind: 'association', source: 'n_student', target: 'n_order' })

describe('applyBatch', () => {
  it('applies every command in order, as one change', () => {
    const doc = apply(
      createSampleDocument(),
      applyBatch({
        commands: [addNode({ node: order }), addEdge({ edge: toOrder }), renameNode({ id: 'n_order', name: 'Orden' })],
      }),
    )

    expect(doc.nodes.n_order?.name).toBe('Orden')
    expect(doc.edges.e_order).toBeDefined()
    expectValid(doc)
  })

  it('is all or nothing: an unknown command leaves the document untouched', () => {
    const base = createSampleDocument()

    expect(() =>
      apply(base, applyBatch({ commands: [addNode({ node: order }), { type: 'no.existe', payload: {} }] })),
    ).toThrow(/Comando desconocido/)
    expect(base.nodes.n_order).toBeUndefined()
  })

  it('has a JSON-serializable payload', () => {
    const command = applyBatch({ commands: [addNode({ node: order })] })
    expect(JSON.parse(JSON.stringify(command))).toEqual(command)
  })
})

describe('entitiesToRestore + restoreEntities', () => {
  it('undoes created, modified and deleted entities', () => {
    const before = createSampleDocument()
    const after = apply(
      before,
      applyBatch({
        commands: [
          addNode({ node: order }),
          addEdge({ edge: toOrder }),
          renameNode({ id: 'n_student', name: 'Alumno' }),
          removeNodes({ ids: ['n_person'] }),
        ],
      }),
    )

    const restore = entitiesToRestore(before, after)
    // Only what changed: the sample has nothing else, but nothing more is listed.
    expect(Object.keys(restore.nodes).sort()).toEqual(['n_order', 'n_person', 'n_student'])
    expect(restore.nodes.n_order).toBeNull()
    expect(restore.edges.e_inherits).toEqual(before.edges.e_inherits)

    const reverted = apply(after, restoreEntities(restore))
    expect(reverted.nodes).toEqual(before.nodes)
    expect(reverted.edges).toEqual(before.edges)
    expectValid(reverted)
  })

  it('lists nothing when nothing changed', () => {
    const doc = createSampleDocument()
    expect(entitiesToRestore(doc, doc)).toEqual({ nodes: {}, edges: {} })
  })

  // §5.4.1: someone connected a relation to the AI's class while the room voted.
  it('drops edges left pointing at an entity that is gone', () => {
    const before = createSampleDocument()
    const proposed = apply(before, addNode({ node: order }))
    const restore = entitiesToRestore(before, proposed)

    const meanwhile = apply(proposed, addEdge({ edge: toOrder }))
    const reverted = apply(meanwhile, restoreEntities(restore))

    expect(reverted.nodes.n_order).toBeUndefined()
    expect(reverted.edges.e_order).toBeUndefined()
    expectValid(reverted)
  })

  // §5.4.2: the package a restored class lived in was deleted meanwhile.
  it('un-parents a restored node whose package is gone', () => {
    const pkg = createNode({ id: 'n_pkg', kind: 'package', position: { x: 0, y: 0 }, compartmentIds: [] })
    const before = apply(createSampleDocument(), addNode({ node: pkg }), setNodeParent({ id: 'n_student', parentId: 'n_pkg' }))
    const proposed = apply(before, removeNodes({ ids: ['n_student'] }))
    const restore = entitiesToRestore(before, proposed)

    const meanwhile = apply(proposed, removeNodes({ ids: ['n_pkg'] }))
    const reverted = apply(meanwhile, restoreEntities(restore))

    expect(reverted.nodes.n_student?.parentId).toBeNull()
    expectValid(reverted)
  })

  it('is idempotent: applying the same restore twice changes nothing more', () => {
    const before = createSampleDocument()
    const after = apply(before, addNode({ node: order }))
    const command = restoreEntities(entitiesToRestore(before, after))

    const once = apply(after, command)
    expect(apply(once, command)).toEqual(once)
  })
})
