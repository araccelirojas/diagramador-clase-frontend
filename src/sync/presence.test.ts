import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { throttle } from '@/lib/throttle'
import {
  deriveStatus,
  EDITING_WINDOW_MS,
  IDLE_AFTER_MS,
  initials,
  participantColor,
  type LocalActivity,
} from '@/sync/presence'

describe('participantColor', () => {
  it('is stable for the same user', () => {
    expect(participantColor('u-1')).toBe(participantColor('u-1'))
  })

  it('spreads different users over the palette', () => {
    const colors = new Set(Array.from({ length: 40 }, (_, index) => participantColor(`user-${index}`)))
    expect(colors.size).toBeGreaterThan(5)
  })

  it('returns a hex color', () => {
    expect(participantColor('cualquiera')).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('initials', () => {
  it('takes first and last word', () => {
    expect(initials('Ana María López')).toBe('AL')
  })

  it('handles one word, extra spaces and empty names', () => {
    expect(initials('  ana ')).toBe('A')
    expect(initials('')).toBe('?')
  })
})

describe('deriveStatus', () => {
  const base: LocalActivity = {
    recording: false,
    typing: false,
    editingField: false,
    lastEditAt: null,
    lastInputAt: 0,
    hidden: false,
  }

  it('is "conectado" when nothing is going on', () => {
    expect(deriveStatus(base, 1000)).toBe('conectado')
  })

  it('recording beats typing beats editing', () => {
    const all = { ...base, recording: true, typing: true, editingField: true }
    expect(deriveStatus(all, 0)).toBe('grabando')
    expect(deriveStatus({ ...all, recording: false }, 0)).toBe('escribiendo')
    expect(deriveStatus({ ...all, recording: false, typing: false }, 0)).toBe('editando')
  })

  it('a recent command counts as editing, an old one does not', () => {
    const activity = { ...base, lastEditAt: 10_000, lastInputAt: 10_000 }
    expect(deriveStatus(activity, 10_000 + EDITING_WINDOW_MS - 1)).toBe('editando')
    expect(deriveStatus(activity, 10_000 + EDITING_WINDOW_MS)).toBe('conectado')
  })

  it('goes idle after a while without input, or when the tab is hidden', () => {
    expect(deriveStatus(base, IDLE_AFTER_MS)).toBe('inactivo')
    expect(deriveStatus({ ...base, hidden: true }, 1)).toBe('inactivo')
  })

  it('editing wins over idle: a focused field is someone working', () => {
    expect(deriveStatus({ ...base, editingField: true, hidden: true }, IDLE_AFTER_MS)).toBe('editando')
  })
})

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends the first call at once and the last one when the window closes', () => {
    const calls: number[] = []
    const send = throttle((value: number) => calls.push(value), 50)

    send(1)
    send(2)
    send(3)
    expect(calls).toEqual([1])

    vi.advanceTimersByTime(50)
    expect(calls).toEqual([1, 3])
  })

  it('never sends more than once per window', () => {
    const calls: number[] = []
    const send = throttle((value: number) => calls.push(value), 50)

    for (let index = 0; index < 20; index += 1) {
      send(index)
      vi.advanceTimersByTime(10)
    }
    vi.advanceTimersByTime(50)

    // 200 ms of calls + the final trailing one: at most one per 50 ms.
    expect(calls.length).toBeLessThanOrEqual(5)
    expect(calls[calls.length - 1]).toBe(19)
  })

  it('cancel drops the pending trailing call', () => {
    const calls: number[] = []
    const send = throttle((value: number) => calls.push(value), 50)

    send(1)
    send(2)
    send.cancel()
    vi.advanceTimersByTime(100)

    expect(calls).toEqual([1])
  })
})
