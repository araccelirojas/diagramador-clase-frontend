import { produce } from 'immer'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import { applyCommand, type Command } from '@/state/commands'
import {
  canRedo,
  canUndo,
  createHistory,
  pushSnapshot,
  shouldCoalesce,
  type History,
} from '@/state/history'
import { createDocument, MAIN_DIAGRAM_ID } from '@/uml/model/factories'
import type { ClassifierKind, MemberKind, RelationKind, UmlDocument } from '@/uml/model/types'

/**
 * The one store (CLAUDE.md §6.1). `doc` is the document exactly as it will be
 * saved: serialize() is almost the identity.
 *
 * Every document mutation goes through `dispatch`. Selection, tool and pending
 * connection are ephemeral view state: they live here but never get serialized.
 */

export type ToolState =
  | { kind: 'select' }
  /** `variantId` picks a palette variant of the same kind, e.g. an abstract class. */
  | { kind: 'classifier'; classifierKind: ClassifierKind; variantId?: string }
  | { kind: 'relation'; relationKind: RelationKind }
  /** Adds a member to whichever classifier it is dropped on or clicked. */
  | { kind: 'member'; memberKind: MemberKind }

export type Selection = { nodes: string[]; edges: string[] }

export type DispatchOptions = {
  /** false for gestures nobody expects Ctrl+Z to undo, such as pan/zoom. */
  history?: boolean
  /** Injectable clock so history coalescing is testable. */
  now?: number
}

export type DiagramState = {
  doc: UmlDocument
  activeDiagramId: string
  selection: Selection
  tool: ToolState
  pendingConnection: { sourceId: string } | null
  /** Transient message for the canvas (why a connection was refused, etc). */
  notice: { text: string; at: number } | null
  /** Set by every command; cleared once a save lands (§10.3). */
  isDirty: boolean
  history: History

  dispatch: (command: Command, options?: DispatchOptions) => void
  undo: () => void
  redo: () => void

  setSelection: (selection: Partial<Selection>) => void
  clearSelection: () => void
  setTool: (tool: ToolState) => void
  setPendingConnection: (pending: { sourceId: string } | null) => void
  setNotice: (text: string | null) => void
  /**
   * Replaces the whole document and drops the history with it.
   *
   * `dirty` says whether the backend already holds this document. Loading a
   * project: false, it just came from there. Importing a file: **true**, or the
   * import would sit in the browser looking saved and never reach the cloud.
   */
  replaceDocument: (doc: UmlDocument, options?: { dirty?: boolean }) => void
  /** Autosave landed: the backend now holds what the store holds. */
  markSaved: () => void
}

/** Selection may only point at elements that still exist. */
function pruneSelection(doc: UmlDocument, selection: Selection): Selection {
  const nodes = selection.nodes.filter((id) => doc.nodes[id] !== undefined)
  const edges = selection.edges.filter((id) => doc.edges[id] !== undefined)

  const sameNodes = nodes.length === selection.nodes.length
  const sameEdges = edges.length === selection.edges.length

  return sameNodes && sameEdges ? selection : { nodes, edges }
}

export const useDiagramStore = create<DiagramState>()(
  immer((set, get) => ({
    doc: createDocument(),
    activeDiagramId: MAIN_DIAGRAM_ID,
    selection: { nodes: [], edges: [] },
    tool: { kind: 'select' },
    pendingConnection: null,
    notice: null,
    isDirty: false,
    history: createHistory(),

    dispatch: (command, options = {}) => {
      const previous = get().doc
      const next = produce(previous, (draft) => {
        applyCommand(draft, command)
      })

      // immer returns the same reference when the command changed nothing.
      if (next === previous) return

      const record = options.history !== false
      const now = options.now ?? Date.now()

      set((state) => {
        if (record) {
          if (shouldCoalesce(state.history, command.type, now)) {
            // Extend the entry that is already there instead of adding one.
            state.history.lastAt = now
            state.history.future.length = 0
          } else {
            pushSnapshot(state.history, previous, command.type, now)
          }
        }

        state.doc = next
        state.isDirty = true
        state.selection = pruneSelection(next, state.selection as Selection)
      })
    },

    undo: () => {
      const { history, doc } = get()
      if (!canUndo(history)) return

      const previous = history.past[history.past.length - 1]
      if (!previous) return

      set((state) => {
        state.history.past.pop()
        state.history.future.push(doc)
        state.history.lastType = null
        state.doc = previous
        state.isDirty = true
        state.selection = pruneSelection(previous, state.selection as Selection)
      })
    },

    redo: () => {
      const { history, doc } = get()
      if (!canRedo(history)) return

      const next = history.future[history.future.length - 1]
      if (!next) return

      set((state) => {
        state.history.future.pop()
        state.history.past.push(doc)
        state.history.lastType = null
        state.doc = next
        state.isDirty = true
        state.selection = pruneSelection(next, state.selection as Selection)
      })
    },

    setSelection: (selection) => {
      set((state) => {
        if (selection.nodes) state.selection.nodes = [...selection.nodes]
        if (selection.edges) state.selection.edges = [...selection.edges]
      })
    },

    clearSelection: () => {
      set((state) => {
        state.selection.nodes = []
        state.selection.edges = []
      })
    },

    setTool: (tool) => {
      set((state) => {
        state.tool = tool
        state.pendingConnection = null
      })
    },

    setPendingConnection: (pending) => {
      set((state) => {
        state.pendingConnection = pending
      })
    },

    setNotice: (text) => {
      set((state) => {
        // `at` makes two identical messages in a row still count as new.
        state.notice = text === null ? null : { text, at: Date.now() }
      })
    },

    markSaved: () => {
      set((state) => {
        state.isDirty = false
      })
    },

    replaceDocument: (doc, options = {}) => {
      set((state) => {
        state.doc = doc
        state.activeDiagramId = doc.diagrams[0]?.id ?? MAIN_DIAGRAM_ID
        state.selection = { nodes: [], edges: [] }
        state.pendingConnection = null
        state.notice = null
        state.history = createHistory()
        state.isDirty = options.dirty === true
      })
    },
  })),
)

/** Reading the document from outside React (§6.1: never mirror state in a ref). */
export const getDocument = (): UmlDocument => useDiagramStore.getState().doc
