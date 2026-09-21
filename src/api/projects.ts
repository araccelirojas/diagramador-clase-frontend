import { apiFetch, apiFetchBlob } from '@/api/client'
import type { ContenidoProyecto, Proyecto, ProyectoResumen } from '@/api/types'

/** `/api/proyectos/*`. */

/** Owned projects plus those reached through an accepted invitation. */
export function listProjects(signal?: AbortSignal): Promise<ProyectoResumen[]> {
  return apiFetch<ProyectoResumen[]>('/proyectos', { signal })
}

/**
 * `contenido` es opcional: un proyecto normal nace vacío, pero uno importado desde un
 * boceto nace con su diagrama puesto, en un solo viaje y sin existir nunca a medias.
 */
export function createProject(nombre: string, contenido?: unknown): Promise<Proyecto> {
  return apiFetch<Proyecto>('/proyectos', {
    method: 'POST',
    body: contenido === undefined ? { nombre } : { nombre, contenido },
  })
}

export function getProject(id: string, signal?: AbortSignal): Promise<Proyecto> {
  return apiFetch<Proyecto>(`/proyectos/${id}`, { signal })
}

/**
 * The diagram itself. `contenido` travels as a JSON object, never as a string
 * (CLAUDE.md §10), which is why `io/` has to validate a value and not raw text.
 */
export function loadContent(id: string, signal?: AbortSignal): Promise<ContenidoProyecto> {
  return apiFetch<ContenidoProyecto>(`/proyectos/${id}/contenido`, { signal })
}

/**
 * Saves the diagram. `contenido` is the canonical document object (§5), the
 * very same thing the .uml.json file holds.
 *
 * `keepalive` is for the save fired when the tab is closing: without it the
 * browser cancels the request as the page unloads and the last edits are lost.
 */
export function saveContent(
  id: string,
  contenido: unknown,
  options: { keepalive?: boolean } = {},
): Promise<Proyecto> {
  return apiFetch<Proyecto>(`/proyectos/${id}/contenido`, {
    method: 'PUT',
    body: { contenido },
    keepalive: options.keepalive,
  })
}

/**
 * El backend Spring Boot generado a partir del diagrama, como zip.
 *
 * El nombre del fichero lo decide el servidor en `Content-Disposition`, pero `fetch` no lo
 * expone sin CORS extra, asi que el que descarga se compone en el cliente.
 */
export function exportBackend(id: string, signal?: AbortSignal): Promise<Blob> {
  return apiFetchBlob(`/proyectos/${id}/exportar`, { signal })
}
