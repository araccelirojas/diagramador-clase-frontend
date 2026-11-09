import { produce } from 'immer'
import { beforeEach, describe, expect, it } from 'vitest'

import { applyCommand, type Command } from '@/state/commands'
import { useDiagramStore } from '@/state/useDiagramStore'
import { applyProposal, runProposal } from '@/ia/proposal'
import { createDocument, createEdge, createNode } from '@/uml/model/factories'
import { umlDocumentSchema } from '@/uml/model/schema'
import type { UmlDocument } from '@/uml/model/types'

/** Two classes and a relation: enough to create, modify and delete. */
function shop(): UmlDocument {
  const doc = createDocument({ name: 'Tienda' })
  const diagramId = doc.diagrams[0]!.id
  const cls = (id: string, name: string, x: number) =>
    (doc.nodes[id] = createNode({ id, kind: 'class', name, diagramId, position: { x, y: 0 }, compartmentIds: ['attributes', 'operations'] }))

  cls('n_client', 'Cliente', 0)
  cls('n_product', 'Producto', 400)
  doc.edges.e_buys = createEdge({ id: 'e_buys', kind: 'association', diagramId, source: 'n_client', target: 'n_product' })
  return doc
}

const valid = (doc: UmlDocument) => umlDocumentSchema.safeParse(doc).success

beforeEach(() => {
  useDiagramStore.getState().replaceDocument(shop())
})

describe('runProposal', () => {
  it('chains operations over the working copy and leaves the store alone', () => {
    const base = useDiagramStore.getState().doc
    const { results, commands, after } = runProposal(base, [
      { nombre: 'crear_clase', argumentos: { nombre: 'Pedido' } },
      // Only works if the class created one line above is already visible.
      { nombre: 'agregar_atributo', argumentos: { clase: 'Pedido', nombre: 'fecha', tipo: 'Date' } },
      { nombre: 'crear_relacion', argumentos: { origen: 'Cliente', destino: 'Pedido', tipo: 'asociacion' } },
    ])

    expect(results.map((r) => r.ok)).toEqual([true, true, true])
    expect(useDiagramStore.getState().doc).toBe(base)

    const order = Object.values(after.nodes).find((n) => n.name === 'Pedido')
    expect(order?.compartments.attributes?.map((m) => m.name)).toEqual(['fecha'])
    expect(valid(after)).toBe(true)

    // Replaying the collected commands rebuilds the same document: this is what the room gets.
    const replayed = commands.reduce(
      (doc: UmlDocument, command: Command) => produce(doc, (d) => applyCommand(d, command)),
      base,
    )
    expect(replayed).toEqual(after)
  })

  it('refuses tools the chat AI may not use, without stopping the rest', () => {
    const { results } = runProposal(useDiagramStore.getState().doc, [
      { nombre: 'deshacer', argumentos: {} },
      { nombre: 'resumen_diagrama', argumentos: {} },
      { nombre: 'renombrar_clase', argumentos: { actual: 'Producto', nuevo: 'Articulo' } },
    ])

    expect(results.map((r) => r.ok)).toEqual([false, false, true])
  })

  it('deletes without asking: the vote is the confirmation', () => {
    const { results, after } = runProposal(useDiagramStore.getState().doc, [
      { nombre: 'eliminar_clase', argumentos: { nombre: 'Producto' } },
    ])

    expect(results[0]?.ok).toBe(true)
    expect(after.nodes.n_product).toBeUndefined()
    expect(after.edges.e_buys).toBeUndefined()
  })
})

describe('applyProposal', () => {
  it('lands as one change outside the history, and its reversion undoes it', () => {
    const before = useDiagramStore.getState().doc
    const ack = applyProposal({
      idPropuesta: 'p1',
      operaciones: [
        { nombre: 'crear_clase', argumentos: { nombre: 'Pedido' } },
        { nombre: 'renombrar_clase', argumentos: { actual: 'Cliente', nuevo: 'Comprador' } },
        { nombre: 'eliminar_clase', argumentos: { nombre: 'Producto' } },
      ],
    })

    expect(ack.ok).toBe(true)
    if (!ack.ok) return
    expect(ack.aplicado).toBe(true)
    expect(useDiagramStore.getState().history.past).toHaveLength(0)

    const after = useDiagramStore.getState().doc
    const order = Object.values(after.nodes).find((n) => n.name === 'Pedido')!
    // Provisional: the new class and the renamed one. The deleted one is not on the canvas.
    expect(ack.nodos.sort()).toEqual([order.id, 'n_client'].sort())
    expect(ack.aristas).toEqual([])

    // The reversion travels as JSON through the server and back.
    const reversion = JSON.parse(JSON.stringify(ack.reversion)) as Command
    useDiagramStore.getState().dispatch(reversion, { history: false })

    const reverted = useDiagramStore.getState().doc
    expect(reverted.nodes).toEqual(before.nodes)
    expect(reverted.edges).toEqual(before.edges)
    expect(valid(reverted)).toBe(true)
  })

  it('reports nothing applied when every operation failed', () => {
    const before = useDiagramStore.getState().doc
    const ack = applyProposal({
      idPropuesta: 'p2',
      operaciones: [{ nombre: 'renombrar_clase', argumentos: { actual: 'NoExiste', nuevo: 'X' } }],
    })

    expect(ack).toMatchObject({ ok: true, aplicado: false, reversion: null })
    expect(useDiagramStore.getState().doc).toBe(before)
  })

  it('rejects a payload with the wrong shape instead of throwing', () => {
    expect(applyProposal({ operaciones: 'todo' })).toMatchObject({ ok: false })
    expect(applyProposal(null)).toMatchObject({ ok: false })
  })
})
