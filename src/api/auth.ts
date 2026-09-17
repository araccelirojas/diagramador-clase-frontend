import { apiFetch } from '@/api/client'
import type { Sesion, Usuario } from '@/api/types'

/**
 * `/api/auth/*`. One function per endpoint, zero UI logic.
 *
 * Function names are English like the rest of `src/`; the payload keys stay in
 * Spanish because they are the backend's wire contract, not ours.
 */

export type LoginPayload = {
  correo: string
  password: string
}

export type RegisterPayload = LoginPayload & {
  nombre: string
}

export function login(payload: LoginPayload): Promise<Sesion> {
  return apiFetch<Sesion>('/auth/login', { method: 'POST', body: payload })
}

/** The backend already returns a token here, so signing up logs you straight in. */
export function register(payload: RegisterPayload): Promise<Sesion> {
  return apiFetch<Sesion>('/auth/registro', { method: 'POST', body: payload })
}

/** Confirms that a token restored from localStorage is still valid. */
export function fetchProfile(signal?: AbortSignal): Promise<Usuario> {
  return apiFetch<Usuario>('/auth/perfil', { signal })
}
