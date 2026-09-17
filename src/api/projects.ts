import { apiFetch } from '@/api/client'
import type { ContenidoProyecto, Proyecto, ProyectoResumen } from '@/api/types'

/** `/api/proyectos/*`. */

/** Owned projects plus those reached through an accepted invitation. */
export function listProjects(signal?: AbortSignal): Promise<ProyectoResumen[]> {
  return apiFetch<ProyectoResumen[]>('/proyectos', { signal })
}

export function createProject(nombre: string): Promise<Proyecto> {
  return apiFetch<Proyecto>('/proyectos', { method: 'POST', body: { nombre } })
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
