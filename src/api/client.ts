/**
 * The single place that talks HTTP. Everything above it deals in typed values
 * and `ApiError`, never in `Response` objects or status codes scattered around
 * components.
 *
 * `uml/` and `state/commands/` must not import this file: the domain model does
 * not know a network exists (CLAUDE.md §4).
 */

const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(/\/+$/, '')

export class ApiError extends Error {
  /** 0 when the request never reached the server (offline, CORS, server down). */
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }

  get isNetworkError(): boolean {
    return this.status === 0
  }
}

/**
 * The session lives in `auth/useAuthStore`, which registers itself here. The
 * dependency points auth -> api and never the other way, so `api/` stays
 * importable from a test with no store and no React.
 */
let readToken: () => string | null = () => null
let handleUnauthorized: () => void = () => {}

export function configureApi(options: {
  readToken: () => string | null
  onUnauthorized: () => void
}): void {
  readToken = options.readToken
  handleUnauthorized = options.onUnauthorized
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Serialized as JSON. */
  body?: unknown
  /** Lets a component drop an in-flight request when it unmounts. */
  signal?: AbortSignal
  /**
   * Keeps the request alive after the page goes away, which is the only way a
   * save fired on tab close actually reaches the server. The browser caps a
   * keepalive body at 64 KB, so the caller must check the size first.
   */
  keepalive?: boolean
}

/** The backend always fails with `{ message }` (see its errorHandler). */
async function messageOf(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (body !== null && typeof body === 'object' && 'message' in body) {
      const { message } = body as { message: unknown }
      if (typeof message === 'string' && message !== '') return message
    }
  } catch {
    // An HTML error page or an empty body: fall through to the generic text.
  }

  return `La petición falló con el código ${response.status}.`
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = readToken()

  // FormData trae su propio Content-Type con el `boundary`; ponerlo a mano lo rompe.
  const esFormulario = options.body instanceof FormData

  const headers: Record<string, string> = {}
  if (options.body !== undefined && !esFormulario) headers['Content-Type'] = 'application/json'
  if (token !== null) headers.Authorization = `Bearer ${token}`

  let response: Response

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body:
        options.body === undefined
          ? undefined
          : esFormulario
            ? (options.body as FormData)
            : JSON.stringify(options.body),
      signal: options.signal,
      keepalive: options.keepalive,
    })
  } catch (error) {
    // An aborted request is not a failure: let the caller ignore it as such.
    if (error instanceof DOMException && error.name === 'AbortError') throw error

    throw new ApiError(
      'No se pudo contactar al servidor. Revisa que el backend esté corriendo.',
      0,
    )
  }

  if (!response.ok) {
    // An expired or tampered token: drop the session instead of letting every
    // screen render its own "no autorizado". Only when we actually sent one,
    // so a failed login does not look like a session expiring.
    if (response.status === 401 && token !== null) handleUnauthorized()

    throw new ApiError(await messageOf(response), response.status)
  }

  // 204 (delete) has no body; `response.json()` would throw on it.
  if (response.status === 204) return undefined as T

  return (await response.json()) as T
}

/**
 * Igual que `apiFetch`, pero devuelve el cuerpo como Blob.
 *
 * Existe aparte y no como opcion de `apiFetch` porque el tipo de retorno cambia: un
 * `Promise<T>` que a veces es JSON y a veces un Blob obliga a castear en cada llamada.
 */
export async function apiFetchBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const token = readToken()

  const headers: Record<string, string> = {}
  if (token !== null) headers.Authorization = `Bearer ${token}`

  let response: Response

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error

    throw new ApiError('No se pudo contactar al servidor.', 0)
  }

  if (!response.ok) {
    if (response.status === 401 && token !== null) handleUnauthorized()
    throw new ApiError(await messageOf(response), response.status)
  }

  return response.blob()
}
