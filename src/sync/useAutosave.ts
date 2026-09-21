import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError } from '@/api/client'
import { saveContent } from '@/api/projects'
import { serialize } from '@/io/serialize'
import { useDiagramStore } from '@/state/useDiagramStore'

/**
 * Keeps the backend in step with the document.
 *
 * Four ways a save happens, because no single one covers every exit:
 *
 * 1. **~1.5 s after the user stops editing.** The one that does the actual
 *    work: it keeps the window in which an edit exists only in the browser down
 *    to a second or two.
 * 2. **Every 15 s**, but only when `isDirty` — the heartbeat that was asked
 *    for, here as a safety net for whatever the debounce missed. CLAUDE.md
 *    §10.3 warns against a blind interval that writes whether or not anybody
 *    touched anything; the flag is what keeps reading a diagram free of traffic.
 * 3. **`flush()`**, awaited by the caller. This is how the back arrow and the
 *    "Proyectos" button hold their navigation open until the diagram is stored.
 * 4. **On the page going away** — close, reload, switching app. Fired from
 *    `pagehide` and `visibilitychange`, and necessarily unawaited.
 *
 * Case 4 has to use `keepalive`: a normal `fetch` is cancelled while the page
 * unloads. Even so it is only best effort — on a reload it races the new page's
 * GET — which is precisely why case 1 exists and this is the last resort.
 */

/** The heartbeat asked for: a safety net, not the main mechanism. */
export const AUTOSAVE_INTERVAL_MS = 15_000

/**
 * The real workhorse. Waiting up to 15 s to write leaves a 15 s window in which
 * reloading or closing loses the last edits, and the closing save can only ever
 * be best effort — the browser may kill it, and on a reload it races the new
 * page's GET. Writing ~1.5 s after the user stops editing shrinks that window
 * to almost nothing. This is the debounce CLAUDE.md §10.3 asked for.
 */
export const AUTOSAVE_DEBOUNCE_MS = 1_500

/**
 * The browser rejects a keepalive request whose body is over 64 KB. Past that
 * we send a normal request: it may not survive the unload, but the 15 s tick
 * and the navigation saves still cover it, and silently sending nothing would
 * be worse.
 */
const KEEPALIVE_MAX_BYTES = 60_000

/**
 * Text edits only reach the store on blur or Enter (`InlineInput`, `TextField`):
 * a keystroke is not a document change, or the history would hold one entry per
 * letter. That means a name typed and left focused has NOT been dispatched yet,
 * so a save fired right then would write the document without it — the "I did it
 * fast and it did not save" case.
 *
 * Blurring the focused field dispatches its commit synchronously, before we read
 * the document.
 */
function commitFocusedField(): void {
  const active = document.activeElement

  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    active.blur()
  }
}

export type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string }

export type Autosave = {
  state: SaveState
  /**
   * Saves now and resolves when the request is done — even if the heartbeat
   * already has one in flight, since that one may predate the last edit.
   * Never rejects: the caller's job is to navigate, not to handle a save error.
   */
  flush: () => Promise<void>
}

type SaveOptions = {
  /** Ignore the in-flight guard. A duplicate PUT is harmless; a lost edit is not. */
  force?: boolean
  /** Survive the page unload. Only for the closing save. */
  keepalive?: boolean
  /** Do not touch the UI: the component is on its way out. */
  silent?: boolean
}

/**
 * @param enabled false until this project's document is actually in the store.
 *   Without it, navigating from project A to project B could write A's diagram
 *   into B: every project shares one route, so the editor re-renders instead of
 *   remounting and the autosave has no way of telling whose document it holds.
 */
export type AutosaveOptions = {
  /**
   * The project's room is saving on its own clock. When true this hook gives up
   * BOTH recurring saves — the debounce and the heartbeat — because the room
   * owns a single timer for everybody: two collaborators must not end up with
   * two counters writing the same diagram at different moments.
   *
   * The save on the way out stays either way. That is not a counter, it is the
   * closing of the door, and it is what covers the socket dropping.
   */
  roomManaged?: boolean
}

export function useAutosave(
  idProyecto: string,
  enabled: boolean,
  options: AutosaveOptions = {},
): Autosave {
  const roomManaged = options.roomManaged === true

  const [state, setState] = useState<SaveState>({ kind: 'idle' })

  /** Guards against two overlapping PUTs of the same project. */
  const savingRef = useRef(false)
  /** The closing path must not call setState on a component that is going away. */
  const mountedRef = useRef(true)

  const save = useCallback(
    async (options: SaveOptions = {}): Promise<void> => {
      if (!enabled) return

      commitFocusedField()

      const { doc, isDirty } = useDiagramStore.getState()

      if (!isDirty) return
      if (savingRef.current && options.force !== true) return

      const snapshot = doc
      const contenido = serialize(snapshot)
      const showUi = options.silent !== true && mountedRef.current

      savingRef.current = true
      if (showUi) setState({ kind: 'saving' })

      try {
        const keepalive =
          options.keepalive === true && JSON.stringify(contenido).length <= KEEPALIVE_MAX_BYTES

        await saveContent(idProyecto, contenido, { keepalive })

        // Only clear the flag if nothing was edited while the request was in
        // flight. immer hands out a new reference on every change, so an
        // identity check is enough — and cheaper than comparing documents.
        if (useDiagramStore.getState().doc === snapshot) useDiagramStore.getState().markSaved()

        if (showUi && mountedRef.current) setState({ kind: 'saved', at: Date.now() })
      } catch (error) {
        // The document stays dirty, so the next tick tries again on its own.
        if (showUi && mountedRef.current) {
          setState({
            kind: 'error',
            message: error instanceof ApiError ? error.message : 'No se pudo guardar el diagrama.',
          })
        }
      } finally {
        savingRef.current = false
      }
    },
    [idProyecto, enabled],
  )

  // Shortly after the user stops editing.
  useEffect(() => {
    if (roomManaged) return

    let timer: ReturnType<typeof setTimeout> | undefined

    const unsubscribe = useDiagramStore.subscribe((state, previous) => {
      // Only a document change counts. Selecting a node or moving the viewport
      // is not something to write to the database.
      if (state.doc === previous.doc) return

      clearTimeout(timer)
      timer = setTimeout(() => void save(), AUTOSAVE_DEBOUNCE_MS)
    })

    return () => {
      unsubscribe()
      clearTimeout(timer)
    }
  }, [save, roomManaged])

  // The heartbeat: catches whatever the debounce missed — a failed save, or an
  // edit that landed while a previous request was still in flight.
  useEffect(() => {
    if (roomManaged) return

    const id = setInterval(() => void save(), AUTOSAVE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [save, roomManaged])

  // Every way the page itself can disappear.
  useEffect(() => {
    mountedRef.current = true

    const saveOnClose = (): void => void save({ force: true, keepalive: true, silent: true })

    // `pagehide` fires on close, reload and back-forward navigation, including
    // the bfcache cases where `beforeunload` never runs. `visibilitychange`
    // covers switching tab or app on mobile, where the page may be killed
    // outright and `pagehide` never arrives.
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') saveOnClose()
    }

    window.addEventListener('pagehide', saveOnClose)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener('pagehide', saveOnClose)
      document.removeEventListener('visibilitychange', onVisibility)

      // Last resort for an unmount nobody blocked on. The awaited `flush()` is
      // the real guarantee; this only catches what it missed.
      mountedRef.current = false
      saveOnClose()
    }
  }, [save])

  const flush = useCallback(() => save({ force: true }), [save])

  return { state, flush }
}
