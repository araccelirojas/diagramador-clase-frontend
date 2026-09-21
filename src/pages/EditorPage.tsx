import { ArrowLeft, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useParams } from 'react-router-dom'

import { ApiError } from '@/api/client'
import { getProject, loadContent } from '@/api/projects'
import type { ProyectoResumen } from '@/api/types'
import App from '@/app/App'
import { documentFromProjectContent } from '@/io/projectContent'
import { useDiagramStore } from '@/state/useDiagramStore'
import type { SaveState } from '@/sync/useAutosave'
import { useAutosave } from '@/sync/useAutosave'
import { useCollaboration } from '@/sync/useCollaboration'

/**
 * Opens one project: fetches its `contenido`, validates it, pushes it into the
 * store, and only then mounts the canvas.
 *
 * The order matters. Rendering `<App />` first and loading afterwards would
 * flash the previous project's diagram — or an empty one — for a frame, and any
 * edit made during that frame would land on the wrong document.
 */

type Estado =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; details: string[] }
  | { kind: 'ready'; proyecto: ProyectoResumen }

export function EditorPage() {
  const { idProyecto } = useParams<{ idProyecto: string }>()
  const replaceDocument = useDiagramStore((state) => state.replaceDocument)

  const [estado, setEstado] = useState<Estado>({ kind: 'loading' })

  /**
   * Every project shares the route `/proyectos/:idProyecto`, so going from one
   * to another re-renders this component instead of remounting it: `estado`
   * still holds the previous project while the new one loads. Deriving this
   * during render — rather than resetting the state inside the effect — closes
   * the window in which the autosave would be armed while the store still held
   * somebody else's diagram.
   */
  const listo = estado.kind === 'ready' && estado.proyecto.idProyecto === idProyecto

  // One room per project, joined only once this project's document is loaded.
  const collaboration = useCollaboration(idProyecto ?? '', listo)

  /**
   * While the room is up it owns the save clock — a single timer for everyone,
   * not one per person. If the socket never connects or drops, this falls back
   * to false and the local autosave takes over on its own.
   */
  const roomManaged = collaboration.status === 'connected'

  // Called before the early returns below, as every hook must be.
  const { state: saveState, flush } = useAutosave(idProyecto ?? '', listo, { roomManaged })

  const isDirty = useDiagramStore((state) => state.isDirty)

  /**
   * What the header shows. In a room the honest signal is the room's own save
   * report: this client's `isDirty` says nothing about whether the person the
   * server asked has written yet.
   */
  const headerState: SaveState = roomManaged
    ? collaboration.error !== null
      ? { kind: 'error', message: collaboration.error }
      : collaboration.savedAt !== null
        ? { kind: 'saved', at: collaboration.savedAt }
        : { kind: 'idle' }
    : saveState

  /**
   * The browser's back arrow and the "Proyectos" button are both in-app
   * navigations, and both used to rely on the save fired while the component
   * unmounted — a request nobody waits for. Blocking the navigation, saving,
   * and only then letting it through makes the guarantee explicit.
   *
   * It deliberately does NOT check `isDirty` first. A name typed and left
   * focused has not been dispatched yet, so the document still looks clean
   * while an edit is sitting in an input; `flush()` commits that field before
   * deciding. When there is genuinely nothing to save it returns immediately
   * and the navigation is delayed by one tick.
   *
   * A full reload is not an in-app navigation and never reaches this: that one
   * is covered by the `pagehide` save inside the hook.
   */
  const shouldBlock = useCallback(
    ({
      currentLocation,
      nextLocation,
    }: {
      currentLocation: { pathname: string }
      nextLocation: { pathname: string }
    }) => listo && currentLocation.pathname !== nextLocation.pathname,
    [listo],
  )

  const blocker = useBlocker(shouldBlock)

  /** The blocker object changes identity on every render; handle each block once. */
  const blockHandledRef = useRef(false)

  useEffect(() => {
    if (blocker.state !== 'blocked') {
      blockHandledRef.current = false
      return
    }

    if (blockHandledRef.current) return
    blockHandledRef.current = true

    // Let the navigation through even if the save failed: trapping the user in
    // the editor would be worse than a diagram that is one edit behind, and the
    // document stays dirty so the next attempt still has it.
    void flush().finally(() => blocker.proceed())
  }, [blocker, flush])

  useEffect(() => {
    if (idProyecto === undefined) return

    const controller = new AbortController()

    const abrir = async (): Promise<void> => {
      try {
        // Two endpoints, two jobs: `/contenido` is the editor's channel for the
        // diagram — the one saving will use too — while the project resource
        // carries the name and the owner that the header shows.
        const [proyecto, { contenido }] = await Promise.all([
          getProject(idProyecto, controller.signal),
          loadContent(idProyecto, controller.signal),
        ])

        const result = documentFromProjectContent(contenido, proyecto.nombre)

        if (!result.ok) {
          setEstado({ kind: 'error', message: result.error, details: result.details })
          return
        }

        replaceDocument(result.doc)
        setEstado({ kind: 'ready', proyecto })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return

        setEstado({
          kind: 'error',
          message:
            error instanceof ApiError ? error.message : 'No se pudo abrir el proyecto.',
          details: [],
        })
      }
    }

    void abrir()

    return () => controller.abort()
  }, [idProyecto, replaceDocument])

  if (estado.kind === 'loading' || (estado.kind === 'ready' && !listo)) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando el diagrama…
        </p>
      </div>
    )
  }

  // A 403, a 404 or a `contenido` that no longer matches the schema all end
  // here. Anything is better than a blank canvas with no explanation (§10.5).
  if (estado.kind === 'error') {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center">
          <h1 className="text-sm font-semibold text-slate-800">No se pudo abrir el proyecto</h1>
          <p className="mt-2 text-sm text-slate-600">{estado.message}</p>

          {estado.details.length > 0 && (
            <ul className="mt-3 list-inside list-disc text-left text-xs text-slate-500">
              {estado.details.map((detalle) => (
                <li key={detalle}>{detalle}</li>
              ))}
            </ul>
          )}

          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-sky-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a mis proyectos
          </Link>
        </div>
      </div>
    )
  }

  return (
    <App
      proyecto={estado.proyecto}
      saveState={headerState}
      dirty={!roomManaged && isDirty}
      collaboration={collaboration}
      flush={flush}
    />
  )
}
