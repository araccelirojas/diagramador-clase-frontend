import { describe, expect, it } from 'vitest'

import { detectarJarvis } from '@/llamada/jarvis'

describe('detectarJarvis', () => {
  it('detecta el nombre al principio y devuelve lo que viene después', () => {
    expect(detectarJarvis('Jarvis, ¿cómo está el proyecto actualmente?')).toEqual({
      resto: '¿cómo está el proyecto actualmente?',
    })
    expect(detectarJarvis('jarvis agregá la clase Socio')).toEqual({ resto: 'agregá la clase Socio' })
  })

  it('acepta como lo suele escribir el transcriptor', () => {
    for (const dicho of ['Yarvis, hola', 'Jarbis, hola', 'Harvis hola', 'Llarvis, hola', 'Jarvys, hola', 'JARVIS: hola']) {
      expect(detectarJarvis(dicho), dicho).toEqual({ resto: 'hola' })
    }
  })

  it('acepta una o dos palabras antes', () => {
    expect(detectarJarvis('Oye Jarvis, ¿qué falta?')).toEqual({ resto: '¿qué falta?' })
    expect(detectarJarvis('Ok, Jarvis. Borrá Película')).toEqual({ resto: 'Borrá Película' })
  })

  it('solo "Jarvis" da un resto vacío: la pregunta viene en la frase siguiente', () => {
    expect(detectarJarvis('Jarvis.')).toEqual({ resto: '' })
  })

  it('si no le hablan a Jarvis, o lo nombran en medio de una frase, no es para él', () => {
    expect(detectarJarvis('¿Cómo está el proyecto?')).toBeNull()
    expect(detectarJarvis('ayer le pregunté a Jarvis por la herencia')).toBeNull()
    expect(detectarJarvis('Jarra de agua')).toBeNull()
    expect(detectarJarvis('')).toBeNull()
  })
})
