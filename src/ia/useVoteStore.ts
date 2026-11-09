import { create } from 'zustand'

/**
 * The room's vote on a change the AI made (CU-04).
 *
 * The server owns it — who voted, who is missing, when it closes — and sends
 * the whole state on every change. This store only holds the last one it sent,
 * plus the local deadline for the countdown. It is room state, not document
 * state: it never touches `doc` and is never saved.
 */

export type VoteChoice = 'conservar' | 'descartar'

export type Voter = { idUsuario: string; nombre: string }

export type Vote = {
  idPropuesta: string
  solicitante: Voter | null
  /** One line per operation that worked, as the tools reported it. */
  cambios: string[]
  /** What is provisional on the canvas while the vote is open. */
  nodos: string[]
  aristas: string[]
  votos: (Voter & { voto: VoteChoice })[]
  faltantes: Voter[]
  quedanMs: number
  estado: 'abierta' | 'conservada' | 'descartada'
  /** How it was decided, once closed. */
  motivo: 'mayoria' | 'desempate' | 'sin-votos' | null
}

export type VoteSender = (vote: { idPropuesta: string; voto: VoteChoice }) => Promise<{ ok: boolean; message?: string }>

type VoteState = {
  vote: Vote | null
  /** Local clock time when it closes; the server sends "ms left", not a timestamp, so skew does not matter. */
  deadline: number | null
  error: string | null
  send: VoteSender | null

  received: (vote: Vote | null, now?: number) => void
  setSender: (send: VoteSender | null) => void
  reset: () => void
}

/** A closed vote stays on screen this long, so everyone sees how it ended. */
export const CLOSED_VISIBLE_MS = 8000

let clearTimer: ReturnType<typeof setTimeout> | null = null

export const useVoteStore = create<VoteState>()((set, get) => ({
  vote: null,
  deadline: null,
  error: null,
  send: null,

  received: (vote, now = Date.now()) => {
    if (clearTimer) clearTimeout(clearTimer)
    clearTimer = null

    if (vote === null) {
      set({ vote: null, deadline: null, error: null })
      return
    }

    const sameVote = get().vote?.idPropuesta === vote.idPropuesta
    set({
      vote,
      deadline: vote.estado === 'abierta' ? now + vote.quedanMs : null,
      error: sameVote ? get().error : null,
    })

    if (vote.estado !== 'abierta') {
      clearTimer = setTimeout(() => {
        if (get().vote?.idPropuesta === vote.idPropuesta) set({ vote: null, deadline: null, error: null })
      }, CLOSED_VISIBLE_MS)
    }
  },

  setSender: (send) => set({ send }),

  reset: () => {
    if (clearTimer) clearTimeout(clearTimer)
    clearTimer = null
    set({ vote: null, deadline: null, error: null, send: null })
  },
}))

/** Votes, or changes one's vote, while it is open. */
export async function castVote(voto: VoteChoice): Promise<void> {
  const { vote, send } = useVoteStore.getState()
  if (!vote || vote.estado !== 'abierta') return

  if (!send) {
    useVoteStore.setState({ error: 'Sin conexión con la sala.' })
    return
  }

  useVoteStore.setState({ error: null })
  const result = await send({ idPropuesta: vote.idPropuesta, voto })
  if (!result.ok) useVoteStore.setState({ error: result.message ?? 'No se pudo registrar el voto.' })
}

/** What this person voted, if they did. */
export function myVote(vote: Vote | null, idUsuario: string | null): VoteChoice | null {
  return vote?.votos.find((v) => v.idUsuario === idUsuario)?.voto ?? null
}
