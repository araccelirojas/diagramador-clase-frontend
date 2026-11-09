import { describe, expect, it } from 'vitest'

import type { Mensaje } from '@/api/types'
import {
  dayLabel,
  formatDuration,
  insertMessage,
  mentionsAI,
  mergePage,
  splitMentions,
  typingLabel,
} from '@/chat/messages'

function message(idMensaje: string, fecha: string, texto = 'hola'): Mensaje {
  return {
    idMensaje,
    idProyecto: 'p',
    autor: 'USUARIO',
    tipo: 'TEXTO',
    texto,
    fecha,
    idCliente: null,
    respondeA: null,
    usuario: { idUsuario: 'u', nombre: 'Ana' },
    mencionA: null,
    tieneAudio: false,
    duracionMs: null,
    transcripcion: null,
  }
}

describe('mentionsAI', () => {
  it('finds @IA as a word anywhere, in any case', () => {
    expect(mentionsAI('@IA ayuda')).toBe(true)
    expect(mentionsAI('che @ia, mirá')).toBe(true)
    expect(mentionsAI('(@IA)')).toBe(true)
  })

  it('ignores lookalikes', () => {
    expect(mentionsAI('@IAN')).toBe(false)
    expect(mentionsAI('yo@ia.com')).toBe(false)
    expect(mentionsAI('IA sin arroba')).toBe(false)
  })
})

describe('splitMentions', () => {
  it('cuts the text around each mention', () => {
    expect(splitMentions('hola @IA qué tal')).toEqual([
      { text: 'hola ', mention: false },
      { text: '@IA', mention: true },
      { text: ' qué tal', mention: false },
    ])
  })

  it('leaves an email alone', () => {
    expect(splitMentions('yo@ia.com')).toEqual([{ text: 'yo@ia.com', mention: false }])
  })
})

describe('insertMessage', () => {
  const a = message('a', '2026-11-05T10:00:00.000Z')
  const b = message('b', '2026-11-05T10:01:00.000Z')

  it('appends the newest message', () => {
    expect(insertMessage([a], b).map((m) => m.idMensaje)).toEqual(['a', 'b'])
  })

  it('replaces a message it already has instead of duplicating it', () => {
    const edited = { ...a, texto: 'otra' }
    const result = insertMessage([a, b], edited)

    expect(result).toHaveLength(2)
    expect(result[0]?.texto).toBe('otra')
  })

  it('puts a late arrival in its place', () => {
    expect(insertMessage([b], a).map((m) => m.idMensaje)).toEqual(['a', 'b'])
  })
})

describe('mergePage', () => {
  it('prepends older history without duplicates', () => {
    const a = message('a', '2026-11-05T10:00:00.000Z')
    const b = message('b', '2026-11-05T10:01:00.000Z')
    const c = message('c', '2026-11-05T10:02:00.000Z')

    expect(mergePage([b, c], [a, b]).map((m) => m.idMensaje)).toEqual(['a', 'b', 'c'])
  })
})

describe('labels', () => {
  it('names today and yesterday', () => {
    const now = new Date('2026-11-05T15:00:00')
    expect(dayLabel(new Date('2026-11-05T09:00:00').toISOString(), now)).toBe('Hoy')
    expect(dayLabel(new Date('2026-11-04T09:00:00').toISOString(), now)).toBe('Ayer')
  })

  it('says who is typing', () => {
    expect(typingLabel([])).toBeNull()
    expect(typingLabel(['Ana'])).toBe('Ana está escribiendo…')
    expect(typingLabel(['Ana', 'Beto'])).toBe('Ana y Beto están escribiendo…')
    expect(typingLabel(['Ana', 'Beto', 'Caro', 'Dani'])).toBe('Ana, Beto y 2 más están escribiendo…')
    expect(typingLabel(['Ana'], 'grabando')).toBe('Ana está grabando…')
  })

  it('formats a duration as m:ss', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(4_600)).toBe('0:05')
    expect(formatDuration(65_400)).toBe('1:05')
  })
})
