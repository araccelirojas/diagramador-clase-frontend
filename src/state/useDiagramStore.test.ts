import { beforeEach, describe, expect, it } from 'vitest'

import { addNode, moveNodes, removeNodes, renameNode, setViewport } from '@/state/commands'
import { HISTORY_LIMIT } from '@/state/history'
import { useDiagramStore } from '@/state/useDiagramStore'
import { createNode } from '@/uml/model/factories'
import { createSampleDocument } from '@/uml/model/sampleDocument'
import type { UmlDocument } from '@/uml/model/types'

const store = useDiagramStore

function reset(doc: UmlDocument = createSampleDocument()): void {
  store.getState().replaceDocument(doc)
}

const doc = (): UmlDocument => store.getState().doc

beforeEach(() => {
  reset()
})

describe('dispatch', () => {
  it('applies the command and marks the document dirty', () => {
    expect(store.getState().isDirty).toBe(false)

    store.getState().dispatch(renameNode({ id: 'n_student', name: 'Alumno' }))

    expect(doc().nodes.n_student?.name).toBe('Alumno')
    expect(store.getState().isDirty).toBe(true)
  })

  it('ignores a command that changes nothing', () => {
    const before = doc()
    store.getState().dispatch(moveNodes({ ids: ['n_ghost'], delta: { x: 5, y: 5 } }))

    expect(doc()).toBe(before)
    expect(store.getState().history.past).toHaveLength(0)
  })

  it('drops selection that points at deleted elements', () => {
    store.getState().setSelection({ nodes: ['n_person'], edges: ['e_inherits'] })
    store.getState().dispatch(removeNodes({ ids: ['n_person'] }))

    expect(store.getState().selection).toEqual({ nodes: [], edges: [] })
  })
})

describe('history', () => {
  it('undoes and redoes back to the exact same document', () => {
    const before = doc()

    store.getState().dispatch(renameNode({ id: 'n_student', name: 'Alumno' }))
    const after = doc()

    store.getState().undo()
    expect(doc()).toEqual(before)

    store.getState().redo()
    expect(doc()).toEqual(after)
  })

  it('survives a whole sequence of commands', () => {
    const before = doc()
    const node = createNode({ id: 'n_new', kind: 'class', position: { x: 5, y: 5 }, compartmentIds: ['attributes'] })

    store.getState().dispatch(addNode({ node }), { now: 0 })
    store.getState().dispatch(moveNodes({ ids: ['n_new'], delta: { x: 10, y: 10 } }), { now: 1000 })
    store.getState().dispatch(removeNodes({ ids: ['n_person'] }), { now: 2000 })

    store.getState().undo()
    store.getState().undo()
    store.getState().undo()

    expect(doc()).toEqual(before)
  })

  it('coalesces commands of the same type fired in a burst', () => {
    for (let index = 0; index < 12; index += 1) {
      store.getState().dispatch(renameNode({ id: 'n_student', name: `Alumno${index}` }), { now: index * 10 })
    }

    // Twelve keystrokes, one undo step.
    expect(store.getState().history.past).toHaveLength(1)

    store.getState().undo()
    expect(doc().nodes.n_student?.name).toBe('Estudiante')
  })

  it('does not coalesce commands separated in time', () => {
    store.getState().dispatch(renameNode({ id: 'n_student', name: 'A' }), { now: 0 })
    store.getState().dispatch(renameNode({ id: 'n_student', name: 'B' }), { now: 5000 })

    expect(store.getState().history.past).toHaveLength(2)
  })

  it('does not coalesce different command types', () => {
    store.getState().dispatch(renameNode({ id: 'n_student', name: 'A' }), { now: 0 })
    store.getState().dispatch(moveNodes({ ids: ['n_student'], delta: { x: 1, y: 0 } }), { now: 10 })

    expect(store.getState().history.past).toHaveLength(2)
  })

  it('drops the oldest entries past the limit', () => {
    for (let index = 0; index < HISTORY_LIMIT + 10; index += 1) {
      store.getState().dispatch(moveNodes({ ids: ['n_student'], delta: { x: 1, y: 0 } }), {
        now: index * 1000,
      })
    }

    expect(store.getState().history.past).toHaveLength(HISTORY_LIMIT)
  })

  it('clears the redo branch on a new edit', () => {
    store.getState().dispatch(renameNode({ id: 'n_student', name: 'A' }), { now: 0 })
    store.getState().undo()
    expect(store.getState().history.future).toHaveLength(1)

    store.getState().dispatch(renameNode({ id: 'n_student', name: 'B' }), { now: 5000 })
    expect(store.getState().history.future).toHaveLength(0)
  })

  it('keeps pan and zoom out of the history', () => {
    store.getState().dispatch(
      setViewport({ id: 'd_main', viewport: { x: 10, y: 10, zoom: 2 } }),
      { history: false },
    )

    expect(doc().diagrams[0]?.viewport.zoom).toBe(2)
    expect(store.getState().history.past).toHaveLength(0)
  })

  it('does nothing when there is nothing to undo or redo', () => {
    expect(() => store.getState().undo()).not.toThrow()
    expect(() => store.getState().redo()).not.toThrow()
    expect(doc()).toEqual(createSampleDocument())
  })
})

describe('replaceDocument', () => {
  it('resets history, selection and the dirty flag', () => {
    store.getState().dispatch(renameNode({ id: 'n_student', name: 'A' }))
    store.getState().setSelection({ nodes: ['n_student'] })

    reset()

    expect(store.getState().history.past).toHaveLength(0)
    expect(store.getState().selection).toEqual({ nodes: [], edges: [] })
    expect(store.getState().isDirty).toBe(false)
  })
})

describe('markSaved', () => {
  it('clears the dirty flag without touching the document', () => {
    store.getState().dispatch(renameNode({ id: 'n_student', name: 'Alumno' }))
    expect(store.getState().isDirty).toBe(true)

    const antes = doc()
    store.getState().markSaved()

    expect(store.getState().isDirty).toBe(false)
    // Saving is not an edit: same reference, so the autosave's identity check
    // can tell "nothing changed while the request was in flight" from a real edit.
    expect(doc()).toBe(antes)
  })

  it('goes dirty again on the next edit', () => {
    store.getState().markSaved()
    store.getState().dispatch(renameNode({ id: 'n_student', name: 'Otro' }))

    expect(store.getState().isDirty).toBe(true)
  })

  it('leaves undo and redo alone', () => {
    store.getState().dispatch(renameNode({ id: 'n_student', name: 'Alumno' }))
    store.getState().markSaved()

    store.getState().undo()

    expect(doc().nodes.n_student?.name).toBe('Estudiante')
    // Undoing past a save is an edit of its own: it has to be saved too.
    expect(store.getState().isDirty).toBe(true)
  })
})

describe('replaceDocument', () => {
  it('leaves a document loaded from the backend clean', () => {
    store.getState().replaceDocument(createSampleDocument())

    expect(store.getState().isDirty).toBe(false)
  })

  it('marks an imported document dirty so the autosave picks it up', () => {
    // Without this an imported .uml.json sits in the browser looking saved and
    // never reaches the cloud: the autosave only writes when isDirty.
    store.getState().replaceDocument(createSampleDocument(), { dirty: true })

    expect(store.getState().isDirty).toBe(true)
  })

  it('drops the history either way', () => {
    store.getState().dispatch(renameNode({ id: 'n_student', name: 'Alumno' }))
    store.getState().replaceDocument(createSampleDocument(), { dirty: true })

    expect(store.getState().history.past).toHaveLength(0)
    expect(store.getState().history.future).toHaveLength(0)
  })
})
