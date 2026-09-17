import { create } from 'zustand'

import { configureApi } from '@/api/client'
import type { Sesion, Usuario } from '@/api/types'

/**
 * The session: token plus the logged-in user.
 *
 * It does live in localStorage, and that does not contradict CLAUDE.md §2. The
 * ban there is on caching the *document*, where a stale snapshot becomes a
 * ghost bug. A stale token fails loudly with a 401 that this store turns into a
 * clean sign-out.
 */

const STORAGE_KEY = 'diagramador.sesion'

export type AuthState = {
  token: string | null
  usuario: Usuario | null
  signIn: (sesion: Sesion) => void
  signOut: () => void
  /** Refreshes the user after `/auth/perfil` confirms the restored token. */
  setUsuario: (usuario: Usuario) => void
}

type StoredSession = { token: string; usuario: Usuario }

function isStoredSession(value: unknown): value is StoredSession {
  if (value === null || typeof value !== 'object') return false

  const { token, usuario } = value as Partial<StoredSession>

  return (
    typeof token === 'string' &&
    token !== '' &&
    usuario !== null &&
    typeof usuario === 'object' &&
    typeof usuario.idUsuario === 'string'
  )
}

/** Reading it must never throw: private mode and blocked storage both do. */
function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null

    const parsed: unknown = JSON.parse(raw)
    return isStoredSession(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeStoredSession(session: StoredSession | null): void {
  try {
    if (session === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Storage unavailable: the session still works for this tab.
  }
}

const restored = readStoredSession()

export const useAuthStore = create<AuthState>()((set, get) => ({
  token: restored?.token ?? null,
  usuario: restored?.usuario ?? null,

  signIn: (sesion) => {
    writeStoredSession({ token: sesion.token, usuario: sesion.usuario })
    set({ token: sesion.token, usuario: sesion.usuario })
  },

  signOut: () => {
    writeStoredSession(null)
    set({ token: null, usuario: null })
  },

  setUsuario: (usuario) => {
    const { token } = get()
    if (token !== null) writeStoredSession({ token, usuario })
    set({ usuario })
  },
}))

/**
 * Wires the HTTP client to the session. Done once, at module load, so no
 * component has to remember to attach the token, and a 401 from any screen
 * ends the session in one place.
 */
configureApi({
  readToken: () => useAuthStore.getState().token,
  onUnauthorized: () => useAuthStore.getState().signOut(),
})

/** Reading the session outside React (CLAUDE.md §6.1: never mirror it in a ref). */
export const getToken = (): string | null => useAuthStore.getState().token
