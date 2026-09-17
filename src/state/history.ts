import type { UmlDocument } from '@/uml/model/types'

/**
 * Undo/redo for phase 1: a stack of document snapshots (CLAUDE.md §6.4).
 *
 * Snapshots, not inverse commands, on purpose. If phase 4 migrates to Yjs, its
 * UndoManager replaces all of this and the file gets deleted; investing in
 * inverse commands now would be work thrown away.
 */

export const HISTORY_LIMIT = 50

/** Two commands of the same type this close together are one undo step. */
export const COALESCE_MS = 400

export type History = {
  past: UmlDocument[]
  future: UmlDocument[]
  /** Command type of the last recorded entry, for coalescing. */
  lastType: string | null
  /** Timestamp of the last recorded entry, for coalescing. */
  lastAt: number
}

export function createHistory(): History {
  return { past: [], future: [], lastType: null, lastAt: 0 }
}

/**
 * True when this command should extend the previous entry instead of creating
 * one: typing a name letter by letter must not produce 12 undo steps.
 */
export function shouldCoalesce(history: History, type: string, now: number): boolean {
  return (
    history.past.length > 0 && history.lastType === type && now - history.lastAt < COALESCE_MS
  )
}

/** Records the pre-mutation document, dropping the oldest entry past the limit. */
export function pushSnapshot(history: History, snapshot: UmlDocument, type: string, now: number): void {
  history.past.push(snapshot)

  if (history.past.length > HISTORY_LIMIT) {
    history.past.shift()
  }

  // Any new edit invalidates the redo branch.
  history.future.length = 0
  history.lastType = type
  history.lastAt = now
}

export const canUndo = (history: History): boolean => history.past.length > 0
export const canRedo = (history: History): boolean => history.future.length > 0
