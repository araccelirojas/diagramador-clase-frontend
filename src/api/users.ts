import { apiFetch } from '@/api/client'
import type { Usuario } from '@/api/types'

/** `/api/usuarios/*`. */

/**
 * Looks a user up by id. Used to turn the UUID someone pastes into the invite
 * box into a real person — both to get the email the invitation endpoint wants,
 * and to show who is about to be invited before sending anything.
 */
export function getUser(idUsuario: string, signal?: AbortSignal): Promise<Usuario> {
  return apiFetch<Usuario>(`/usuarios/${idUsuario}`, { signal })
}
