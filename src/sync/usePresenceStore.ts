import { create } from 'zustand'

import type {
  EphemeralMessage,
  IncomingEphemeral,
  Participant,
  SentStatus,
  WorldPoint,
} from '@/sync/presence'

/**
 * Who is in the room and what they are doing (CU-01).
 *
 * A store of its own, apart from the diagram store, on purpose: presence is
 * ephemeral (CLAUDE.md §11) and a cursor moving 20 times a second must not
 * re-run a single document selector, nor ever get near `serialize()`.
 */

/** A participant whose connection dropped stays listed this long, then goes. */
export const DISCONNECTED_LINGER_MS = 30_000

export type PresenceState = {
  /** This client's socket id, to tell it apart in the participant list. */
  selfId: string | null
  /** Everyone in the room, this client included, keyed by socket id. */
  participants: Record<string, Participant>
  /** Remote pointers in WORLD coordinates. Absent = outside the canvas. */
  cursors: Record<string, WorldPoint>
  /** What this client last told the room it is doing. */
  selfStatus: SentStatus
  /**
   * Set by features outside the canvas: the chat (CU-02) while typing, the
   * voice note and the voice agent (CU-03) while recording.
   */
  typing: boolean
  /** True while ANY source records: see `recordingSources`. */
  recording: boolean
  /**
   * Who is recording: the voice agent's call and a chat voice note (CU-03) can
   * overlap, and the one that stops must not switch off the other.
   */
  recordingSources: string[]
  /** Sends on the `efimero` channel; null while there is no room. */
  send: ((message: EphemeralMessage) => void) | null

  joined: (selfId: string, participants: Participant[]) => void
  entered: (participant: Participant) => void
  left: (idSocket: string, dropped: boolean) => void
  received: (message: IncomingEphemeral) => void
  setSelfStatus: (status: SentStatus) => void
  setTyping: (typing: boolean) => void
  setRecording: (source: string, active: boolean) => void
  setSender: (send: ((message: EphemeralMessage) => void) | null) => void
  reset: () => void
}

const lingerTimers = new Map<string, ReturnType<typeof setTimeout>>()

function clearLinger(idSocket: string): void {
  const timer = lingerTimers.get(idSocket)
  if (timer !== undefined) clearTimeout(timer)
  lingerTimers.delete(idSocket)
}

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!(key in record)) return record
  const next = { ...record }
  delete next[key]
  return next
}

export const usePresenceStore = create<PresenceState>()((set, get) => ({
  selfId: null,
  participants: {},
  cursors: {},
  selfStatus: 'conectado',
  typing: false,
  recording: false,
  recordingSources: [],
  send: null,

  joined: (selfId, participants) => {
    for (const id of lingerTimers.keys()) clearLinger(id)

    set({
      selfId,
      participants: Object.fromEntries(participants.map((p) => [p.idSocket, p])),
      cursors: {},
    })
  },

  entered: (participant) => {
    set((state) => {
      const participants = { ...state.participants }

      // Back after a dropped connection, with a new socket: the grey
      // "desconectado" ghost of the same person goes at once.
      for (const [id, other] of Object.entries(participants)) {
        if (other.idUsuario === participant.idUsuario && other.estado === 'desconectado') {
          clearLinger(id)
          delete participants[id]
        }
      }

      participants[participant.idSocket] = participant
      return { participants }
    })
  },

  left: (idSocket, dropped) => {
    clearLinger(idSocket)

    if (!dropped) {
      set((state) => ({
        participants: without(state.participants, idSocket),
        cursors: without(state.cursors, idSocket),
      }))
      return
    }

    set((state) => {
      const current = state.participants[idSocket]
      if (!current) return {}

      return {
        participants: {
          ...state.participants,
          [idSocket]: { ...current, estado: 'desconectado', seleccion: { nodos: [], aristas: [] } },
        },
        cursors: without(state.cursors, idSocket),
      }
    })

    lingerTimers.set(
      idSocket,
      setTimeout(() => {
        lingerTimers.delete(idSocket)
        set((state) => ({ participants: without(state.participants, idSocket) }))
      }, DISCONNECTED_LINGER_MS),
    )
  },

  received: (message) => {
    const current = get().participants[message.de]
    // A message from someone we have not been introduced to yet: the `entro`
    // is on its way, and a cursor without a name is worse than no cursor.
    if (!current) return

    if (message.tipo === 'cursor') {
      set((state) => ({
        cursors:
          message.cursor === null
            ? without(state.cursors, message.de)
            : { ...state.cursors, [message.de]: message.cursor },
      }))
      return
    }

    const updated: Participant =
      message.tipo === 'estado'
        ? { ...current, estado: message.estado }
        : { ...current, seleccion: { nodos: message.nodos, aristas: message.aristas } }

    set((state) => ({ participants: { ...state.participants, [message.de]: updated } }))
  },

  setSelfStatus: (selfStatus) => set({ selfStatus }),
  setTyping: (typing) => set({ typing }),
  setRecording: (source, active) =>
    set((state) => {
      const sources = active
        ? [...new Set([...state.recordingSources, source])]
        : state.recordingSources.filter((s) => s !== source)
      return { recordingSources: sources, recording: sources.length > 0 }
    }),
  setSender: (send) => set({ send }),

  reset: () => {
    for (const id of lingerTimers.keys()) clearLinger(id)
    set({ selfId: null, participants: {}, cursors: {}, send: null })
  },
}))

/** Fire-and-forget on the `efimero` channel. A no-op outside a room. */
export function sendEphemeral(message: EphemeralMessage): void {
  usePresenceStore.getState().send?.(message)
}
