import { apiFetch } from '@/api/client'
import type { EstadoInvitacion, Invitacion } from '@/api/types'

/** `/api/invitaciones/*`. */

/**
 * Every invitation the session user can see: the ones sent TO them and the ones
 * issued on projects they own. Splitting the two is the caller's job, because
 * the backend has a single endpoint for both.
 */
export function listInvitations(signal?: AbortSignal): Promise<Invitacion[]> {
  return apiFetch<Invitacion[]>('/invitaciones', { signal })
}

/**
 * Invites someone to a project. The backend identifies the guest by email, so
 * a UUID has to be resolved to a user first (see `getUser`).
 */
export function createInvitation(idProyecto: string, correo: string): Promise<Invitacion> {
  return apiFetch<Invitacion>('/invitaciones', {
    method: 'POST',
    body: { idProyecto, correo },
  })
}

/** Accept or reject. Only the recipient may do this. */
export function respondInvitation(
  idInvitacion: string,
  estado: Extract<EstadoInvitacion, 'ACEPTADA' | 'RECHAZADA'>,
): Promise<Invitacion> {
  return apiFetch<Invitacion>(`/invitaciones/${idInvitacion}`, {
    method: 'PATCH',
    body: { estado },
  })
}

/** Cancel: allowed to the project owner and to the recipient. */
export function cancelInvitation(idInvitacion: string): Promise<void> {
  return apiFetch<void>(`/invitaciones/${idInvitacion}`, { method: 'DELETE' })
}
