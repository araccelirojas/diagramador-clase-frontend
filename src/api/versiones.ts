import { apiFetch } from '@/api/client'
import type { PaginaVersiones, Version, VersionResumen } from '@/api/types'

/**
 * The diagram's version history (CU-05). Versions made by others, or
 * automatically by the room, also arrive live over the socket
 * (`version-creada`); this reads the list and does what a person asks for.
 */

export const VERSIONS_PAGE_SIZE = 30

/** Newest first. `antesDe` is the number of the oldest version already held. */
export function listVersions(
  idProyecto: string,
  options: { antesDe?: number | null; signal?: AbortSignal } = {},
): Promise<PaginaVersiones> {
  const query = new URLSearchParams({ limite: String(VERSIONS_PAGE_SIZE) })
  if (options.antesDe != null) query.set('antesDe', String(options.antesDe))

  return apiFetch<PaginaVersiones>(`/proyectos/${idProyecto}/versiones?${query.toString()}`, {
    signal: options.signal,
  })
}

/** One version, with its diagram. */
export function getVersion(idVersion: string, signal?: AbortSignal): Promise<Version> {
  return apiFetch<Version>(`/versiones/${idVersion}`, { signal })
}

/** "Guardar versión": the diagram as it is on this screen now. */
export function saveVersion(
  idProyecto: string,
  version: { nombre: string | null; contenido: unknown },
): Promise<VersionResumen> {
  return apiFetch<VersionResumen>(`/proyectos/${idProyecto}/versiones`, {
    method: 'POST',
    body: version,
  })
}

/**
 * Asks to restore a version. The server first keeps what is on screen now
 * (`contenidoActual`) as a version of its own, so the restore can be undone,
 * and refuses while the room votes on an AI change.
 */
export function restoreVersion(
  idProyecto: string,
  idVersion: string,
  contenidoActual: unknown,
): Promise<{ version: Version; respaldo: VersionResumen }> {
  return apiFetch(`/proyectos/${idProyecto}/versiones/${idVersion}/restaurar`, {
    method: 'POST',
    body: { contenidoActual },
  })
}
