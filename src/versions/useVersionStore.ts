import { create } from 'zustand'

import { ApiError } from '@/api/client'
import type { VersionResumen } from '@/api/types'
import { listVersions, restoreVersion, saveVersion } from '@/api/versiones'
import { deserializeValue } from '@/io/deserialize'
import { serialize } from '@/io/serialize'
import { useDiagramStore } from '@/state/useDiagramStore'

/**
 * The project's version history (CU-05), as the panel shows it: newest first,
 * one page at a time, plus whatever the room creates while it is open.
 *
 * Separate from `doc` on purpose. A version is a saved copy of the document,
 * not part of it: nothing here is serialized, and the only way a version
 * touches the document is a restore, which goes through `deserialize` like
 * opening a file.
 */

type VersionState = {
  idProyecto: string | null
  versions: VersionResumen[]
  hasMore: boolean
  loaded: boolean
  loading: boolean
  error: string | null

  reset: (idProyecto: string | null) => void
  /** One that arrived over the socket (`version-creada`), or that this client just made. */
  received: (version: VersionResumen) => void
}

const message = (error: unknown, fallback: string): string =>
  error instanceof ApiError || error instanceof Error ? error.message : fallback

/** Newest first, no repeats: the same version can come back from the API and the socket. */
export function insertVersion(list: VersionResumen[], version: VersionResumen): VersionResumen[] {
  if (list.some((v) => v.idVersion === version.idVersion)) return list
  return [...list, version].sort((a, b) => b.numero - a.numero)
}

export const useVersionStore = create<VersionState>()((set) => ({
  idProyecto: null,
  versions: [],
  hasMore: false,
  loaded: false,
  loading: false,
  error: null,

  reset: (idProyecto) =>
    set({ idProyecto, versions: [], hasMore: false, loaded: false, loading: false, error: null }),

  received: (version) =>
    set((state) =>
      state.idProyecto === version.idProyecto
        ? { versions: insertVersion(state.versions, version) }
        : state,
    ),
}))

/** The first page, or the next one with `older`. */
export async function loadVersions(older = false, signal?: AbortSignal): Promise<void> {
  const { idProyecto, versions, loading, hasMore } = useVersionStore.getState()
  if (idProyecto === null || loading || (older && !hasMore)) return

  useVersionStore.setState({ loading: true, error: null })
  try {
    const oldest = versions[versions.length - 1]
    const page = await listVersions(idProyecto, {
      antesDe: older && oldest ? oldest.numero : null,
      signal,
    })
    // The project may have changed while the request was out.
    if (useVersionStore.getState().idProyecto !== idProyecto) return

    useVersionStore.setState((state) => ({
      versions: page.versiones.reduce(insertVersion, older ? state.versions : []),
      hasMore: page.hayMas,
      loaded: true,
      loading: false,
    }))
  } catch (error) {
    if (signal?.aborted) return
    useVersionStore.setState({
      loading: false,
      loaded: true,
      error: message(error, 'No se pudo cargar el historial.'),
    })
  }
}

/** "Guardar versión" with what is on this screen. Throws with a readable message. */
export async function saveCurrentVersion(nombre: string): Promise<VersionResumen> {
  const { idProyecto } = useVersionStore.getState()
  if (idProyecto === null) throw new Error('No hay un proyecto abierto.')

  const version = await saveVersion(idProyecto, {
    nombre: nombre.trim() === '' ? null : nombre.trim(),
    contenido: serialize(useDiagramStore.getState().doc),
  }).catch((error: unknown) => {
    throw new Error(message(error, 'No se pudo guardar la versión.'))
  })

  useVersionStore.getState().received(version)
  return version
}

/**
 * Restores a version for the whole room. The server keeps the current diagram
 * as a version first; the version's content is validated and migrated like an
 * imported file, and replacing the document is what sends it to everyone
 * (`useCollaboration` broadcasts wholesale changes). Throws with a readable
 * message, and leaves the document untouched when it does.
 */
export async function restoreToVersion(idVersion: string): Promise<void> {
  const { idProyecto } = useVersionStore.getState()
  if (idProyecto === null) throw new Error('No hay un proyecto abierto.')

  const { version, respaldo } = await restoreVersion(
    idProyecto,
    idVersion,
    serialize(useDiagramStore.getState().doc),
  ).catch((error: unknown) => {
    throw new Error(message(error, 'No se pudo restaurar la versión.'))
  })
  useVersionStore.getState().received(respaldo)

  const result = deserializeValue(version.contenido)
  if (!result.ok) {
    throw new Error(`La versión ${version.numero} no se pudo abrir: ${result.error}`)
  }

  // dirty: the backend still holds the previous diagram until the room saves.
  useDiagramStore.getState().replaceDocument(result.doc, { dirty: true })
  useDiagramStore
    .getState()
    .setNotice(`Restaurada la versión ${version.numero}. Lo anterior quedó guardado como versión ${respaldo.numero}.`)
}
