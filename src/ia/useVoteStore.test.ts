import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CLOSED_VISIBLE_MS, castVote, myVote, useVoteStore, type Vote } from '@/ia/useVoteStore'
import { NO_PROVISIONAL, selectProvisional } from '@/state/selectors'

const open = (overrides: Partial<Vote> = {}): Vote => ({
  idPropuesta: 'p1',
  solicitante: { idUsuario: 'u-ana', nombre: 'Ana' },
  cambios: ['Creada la clase Pedido.'],
  nodos: ['n_order'],
  aristas: ['e_order'],
  votos: [{ idUsuario: 'u-ana', nombre: 'Ana', voto: 'conservar' }],
  faltantes: [{ idUsuario: 'u-beto', nombre: 'Beto' }],
  quedanMs: 90_000,
  estado: 'abierta',
  motivo: null,
  ...overrides,
})

beforeEach(() => {
  vi.useFakeTimers()
  useVoteStore.getState().reset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useVoteStore', () => {
  it('turns "ms left" into a local deadline', () => {
    useVoteStore.getState().received(open(), 1_000)
    expect(useVoteStore.getState().deadline).toBe(91_000)
  })

  it('keeps a closed vote on screen for a while, then clears it', () => {
    useVoteStore.getState().received(open({ estado: 'conservada', motivo: 'mayoria' }))
    expect(useVoteStore.getState().vote?.estado).toBe('conservada')
    expect(useVoteStore.getState().deadline).toBeNull()

    vi.advanceTimersByTime(CLOSED_VISIBLE_MS)
    expect(useVoteStore.getState().vote).toBeNull()
  })

  it('a new vote arriving cancels the pending clear of the previous one', () => {
    useVoteStore.getState().received(open({ estado: 'descartada', motivo: 'mayoria' }))
    useVoteStore.getState().received(open({ idPropuesta: 'p2' }))

    vi.advanceTimersByTime(CLOSED_VISIBLE_MS)
    expect(useVoteStore.getState().vote?.idPropuesta).toBe('p2')
  })

  it('says it is offline instead of losing the vote silently', async () => {
    useVoteStore.getState().received(open())
    await castVote('descartar')
    expect(useVoteStore.getState().error).toMatch(/Sin conexión/)
  })

  it('sends the vote with the proposal id', async () => {
    const send = vi.fn().mockResolvedValue({ ok: true })
    useVoteStore.getState().setSender(send)
    useVoteStore.getState().received(open())

    await castVote('descartar')
    expect(send).toHaveBeenCalledWith({ idPropuesta: 'p1', voto: 'descartar' })
  })

  it('myVote finds this person among the votes', () => {
    expect(myVote(open(), 'u-ana')).toBe('conservar')
    expect(myVote(open(), 'u-beto')).toBeNull()
  })
})

describe('selectProvisional', () => {
  it('marks what the AI touched only while the vote is open', () => {
    const marks = selectProvisional(open())
    expect([...marks.nodes]).toEqual(['n_order'])
    expect([...marks.edges]).toEqual(['e_order'])

    expect(selectProvisional(open({ estado: 'conservada' }))).toBe(NO_PROVISIONAL)
    expect(selectProvisional(null)).toBe(NO_PROVISIONAL)
  })
})
