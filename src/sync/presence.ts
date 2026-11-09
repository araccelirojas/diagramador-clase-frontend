/**
 * Presence in a room: who is here, where their pointer is, what they have
 * selected and what they are doing (CU-01).
 *
 * All of it is EPHEMERAL (CLAUDE.md §11): it lives outside `doc`, travels on
 * the socket's `efimero` channel, and is never serialized into `contenido`.
 * Wire keys stay in Spanish because they are the backend's protocol, the same
 * as `api/types.ts`.
 */

/** What a participant is doing. `desconectado` is never sent: the room infers it. */
export type ParticipantStatus =
  | 'conectado'
  | 'editando'
  | 'escribiendo'
  | 'grabando'
  | 'inactivo'
  | 'desconectado'

export type SentStatus = Exclude<ParticipantStatus, 'desconectado'>

export type RemoteSelection = { nodos: string[]; aristas: string[] }

/** One socket, not one user: the same person in two tabs is two cursors. */
export type Participant = {
  idSocket: string
  idUsuario: string
  nombre: string
  estado: ParticipantStatus
  seleccion: RemoteSelection
}

export type WorldPoint = { x: number; y: number }

/** What this client sends on `efimero`. */
export type EphemeralMessage =
  | { tipo: 'cursor'; cursor: WorldPoint | null }
  | { tipo: 'seleccion'; nodos: string[]; aristas: string[] }
  | { tipo: 'estado'; estado: SentStatus }

/** What arrives: the same, plus the sender's socket id. */
export type IncomingEphemeral = EphemeralMessage & { de: string }

export const STATUS_LABEL: Record<ParticipantStatus, string> = {
  conectado: 'Conectado',
  editando: 'Editando',
  escribiendo: 'Escribiendo…',
  grabando: 'Grabando…',
  inactivo: 'Inactivo',
  desconectado: 'Desconectado',
}

/**
 * Distinct enough on a light canvas and against each other. Picked by hand
 * rather than spinning a hue: two evenly spaced hues can still be two greens
 * nobody tells apart at a glance.
 */
const COLORS = [
  '#e11d48', // rose-600
  '#2563eb', // blue-600
  '#16a34a', // green-600
  '#d97706', // amber-600
  '#9333ea', // purple-600
  '#0891b2', // cyan-600
  '#db2777', // pink-600
  '#65a30d', // lime-600
  '#ea580c', // orange-600
  '#4f46e5', // indigo-600
] as const

/** FNV-1a: tiny, stable across sessions and browsers, good enough spread. */
function hash(text: string): number {
  let value = 0x811c9dc5

  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 0x01000193)
  }

  return value >>> 0
}

/**
 * Derived from `idUsuario`, never assigned by the server: everyone computes the
 * same color for the same person without agreeing on anything, and it does not
 * change when they reconnect with a new socket.
 */
export function participantColor(idUsuario: string): string {
  return COLORS[hash(idUsuario) % COLORS.length] ?? COLORS[0]
}

/** "Ana María López" → "AL"; "ana" → "A"; "" → "?". */
export function initials(nombre: string): string {
  const words = nombre.trim().split(/\s+/).filter((word) => word !== '')
  const first = words[0]
  if (first === undefined) return '?'

  const last = words.length > 1 ? words[words.length - 1] : undefined
  return (first.charAt(0) + (last?.charAt(0) ?? '')).toUpperCase()
}

/** A command in the last few seconds still counts as "editando". */
export const EDITING_WINDOW_MS = 3000

/** No pointer or key for this long and the person is "inactivo". */
export const IDLE_AFTER_MS = 60_000

export type LocalActivity = {
  /** Holding the record button (CU-03) or in a voice call with the agent. */
  recording: boolean
  /** Typing in the room chat (CU-02). */
  typing: boolean
  /** A field of the diagram has focus: a name being typed is an edit in progress. */
  editingField: boolean
  /** Last local command that changed the document. */
  lastEditAt: number | null
  /** Last pointer move or key press anywhere in the editor. */
  lastInputAt: number
  /** The tab is in the background. */
  hidden: boolean
}

/**
 * What this client tells the room it is doing. One status at a time, the most
 * informative wins: a person recording a voice note is also "connected", and
 * saying so would hide the thing the others want to know.
 */
export function deriveStatus(activity: LocalActivity, now: number): SentStatus {
  if (activity.recording) return 'grabando'
  if (activity.typing) return 'escribiendo'

  if (
    activity.editingField ||
    (activity.lastEditAt !== null && now - activity.lastEditAt < EDITING_WINDOW_MS)
  ) {
    return 'editando'
  }

  if (activity.hidden || now - activity.lastInputAt >= IDLE_AFTER_MS) return 'inactivo'

  return 'conectado'
}
