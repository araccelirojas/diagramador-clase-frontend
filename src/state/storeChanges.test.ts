import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { renameNode, setNodePosition } from '@/state/commands'
import { applyRemote, onStoreChange, useDiagramStore, type StoreChange } from '@/state/useDiagramStore'
import { createSampleDocument } from '@/uml/model/sampleDocument'

/**
 * The hook collaboration hangs off (§6.2). What matters is not that changes are
 * announced, but that the ones ARRIVING from the room are not announced back:
 * without that, two clients bounce the same command between them forever.
 */

const store = useDiagramStore

let heard: StoreChange[]
let stop: () => void

beforeEach(() => {
  // Before subscribing: loading a document is not a change to announce.
  store.getState().replaceDocument(createSampleDocument())
  heard = []
  stop = onStoreChange((change) => heard.push(change))
})

// Listeners live in a module-level set, so one left behind would keep firing
// into the previous test's array for the rest of the run.
afterEach(() => stop())

describe('local changes are announced', () => {
  it('announces a command, with the command itself', () => {
    store.getState().dispatch(renameNode({ id: 'n_student', name: 'Alumno' }))

    const [change] = heard

    expect(change?.kind).toBe('command')
    expect(change?.kind === 'command' && change.command.type).toBe('node.rename')
    // The payload travels as-is: it has to be JSON-serializable (§6.2).
    expect(JSON.parse(JSON.stringify(change))).toEqual(change)
  })

  it('says nothing when the command changed nothing', () => {
    // Same position it already has: immer returns the same document.
    const before = store.getState().doc.nodes.n_student?.position ?? { x: 0, y: 0 }
    store.getState().dispatch(setNodePosition({ id: 'n_student', position: before }))

    expect(heard).toEqual([])
  })

  it('sends the whole document for undo and redo', () => {
    store.getState().dispatch(renameNode({ id: 'n_student', name: 'Alumno' }))
    store.getState().undo()
    store.getState().redo()

    // A command, then two wholesale replacements: undo and redo do not apply a
    // command, so there is nothing small to send.
    expect(heard.map((change) => change.kind)).toEqual(['command', 'document', 'document'])
  })

  it('sends the whole document when one is imported', () => {
    store.getState().replaceDocument(createSampleDocument(), { dirty: true })

    expect(heard.map((change) => change.kind)).toEqual(['document'])
  })
})

describe('changes arriving from the room are NOT announced back', () => {
  it('stays silent for a command applied through applyRemote', () => {
    applyRemote(() => {
      store.getState().dispatch(renameNode({ id: 'n_student', name: 'Alumno' }), { history: false })
    })

    expect(heard).toEqual([])
    // Silent, but applied: the point is to show it, not to announce it.
    expect(store.getState().doc.nodes.n_student?.name).toBe('Alumno')
  })

  it('stays silent for a whole document applied through applyRemote', () => {
    applyRemote(() => store.getState().replaceDocument(createSampleDocument()))

    expect(heard).toEqual([])
  })

  it('goes back to announcing afterwards', () => {
    applyRemote(() => {
      store.getState().dispatch(renameNode({ id: 'n_student', name: 'Remoto' }), { history: false })
    })
    store.getState().dispatch(renameNode({ id: 'n_student', name: 'Local' }))

    expect(heard).toHaveLength(1)
  })

  it('restores the flag even if the remote change throws', () => {
    expect(() =>
      applyRemote(() => {
        throw new Error('comando corrupto')
      }),
    ).toThrow()

    // Otherwise every later local change would be silent and the room would
    // stop seeing this client entirely.
    store.getState().dispatch(renameNode({ id: 'n_student', name: 'Despues' }))

    expect(heard).toHaveLength(1)
  })
})

describe('unsubscribing', () => {
  it('stops the listener', () => {
    stop()
    store.getState().dispatch(renameNode({ id: 'n_student', name: 'Alumno' }))

    expect(heard).toEqual([])
  })
})
