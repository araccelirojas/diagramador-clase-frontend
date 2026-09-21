import { describe, expect, it } from 'vitest'

import { documentFromSketch, ubicar, type Boceto, type ClaseBoceto } from '@/io/sketch'
import { umlDocumentSchema } from '@/uml/model/schema'

/**
 * La conversión de lo que leyó el modelo de visión a un documento UML.
 *
 * Es la parte que hay que blindar: lo que llega viene de un modelo, así que puede tener
 * nombres repetidos, relaciones hacia clases que no existen, posiciones absurdas o tipos
 * inventados. Ninguna de esas cosas puede producir un documento inválido.
 */

const clase = (nombre: string, extra: Partial<ClaseBoceto> = {}): ClaseBoceto => ({
  nombre,
  esInterfaz: false,
  esAbstracta: false,
  caja: { x: 0.1, y: 0.1, ancho: 0.2, alto: 0.15 },
  atributos: [],
  operaciones: [],
  ...extra,
})

const relacion = (extra: Partial<Boceto['relaciones'][number]> = {}) => ({
  tipo: 'association',
  origen: 'A',
  destino: 'B',
  nombre: null,
  multiplicidadOrigen: null,
  multiplicidadDestino: null,
  rolOrigen: null,
  rolDestino: null,
  claseAsociacion: null,
  ...extra,
})

const construir = (boceto: Boceto) => documentFromSketch(boceto, 'Boceto')

describe('un boceto normal', () => {
  const boceto: Boceto = {
    clases: [
      clase('Usuario', {
        caja: { x: 0.05, y: 0.1, ancho: 0.25, alto: 0.2 },
        atributos: [
          { nombre: 'id', tipo: 'int', visibilidad: '-', multiplicidad: null, esClave: true },
          { nombre: 'nombre', tipo: 'String', visibilidad: '-', multiplicidad: '1', esClave: false },
        ],
        operaciones: [
          {
            nombre: 'guardar',
            tipoRetorno: 'void',
            visibilidad: '+',
            parametros: [{ nombre: 'forzar', tipo: 'boolean' }],
          },
        ],
      }),
      clase('Materia', { caja: { x: 0.6, y: 0.1, ancho: 0.25, alto: 0.2 } }),
    ],
    relaciones: [
      relacion({
        origen: 'Usuario',
        destino: 'Materia',
        multiplicidadOrigen: '0..*',
        multiplicidadDestino: '0..*',
      }),
    ],
  }

  it('produce un documento que pasa el mismo zod que una importación de archivo', () => {
    const resultado = construir(boceto)

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(umlDocumentSchema.safeParse(resultado.doc).success).toBe(true)
  })

  it('conserva atributos, tipos y operaciones con sus parámetros', () => {
    const resultado = construir(boceto)
    if (!resultado.ok) return

    const usuario = Object.values(resultado.doc.nodes).find((n) => n.name === 'Usuario')
    const atributos = usuario?.compartments.attributes ?? []
    const operaciones = usuario?.compartments.operations ?? []

    expect(atributos.map((a) => a.name)).toEqual(['id', 'nombre'])
    expect(atributos[0]?.kind === 'property' && atributos[0].type).toBe('int')
    expect(operaciones[0]?.kind === 'operation' && operaciones[0].parameters[0]?.name).toBe('forzar')
  })

  it('traduce "esClave" al modificador {id}, que es lo que usa el exportador', () => {
    const resultado = construir(boceto)
    if (!resultado.ok) return

    const usuario = Object.values(resultado.doc.nodes).find((n) => n.name === 'Usuario')
    const marcados = (usuario?.compartments.attributes ?? []).filter(
      (m) => m.kind === 'property' && m.isId,
    )

    expect(marcados).toHaveLength(1)
    expect(marcados[0]?.name).toBe('id')
  })

  it('respeta las multiplicidades de cada extremo sin inventar', () => {
    const resultado = construir(boceto)
    if (!resultado.ok) return

    const [arista] = Object.values(resultado.doc.edges)

    expect(arista?.ends.source.multiplicity).toBe('0..*')
    expect(arista?.ends.target.multiplicity).toBe('0..*')
  })
})

describe('la clase de asociación', () => {
  const boceto: Boceto = {
    clases: [
      clase('Usuario', { caja: { x: 0.05, y: 0.1, ancho: 0.2, alto: 0.2 } }),
      clase('Materia', { caja: { x: 0.7, y: 0.1, ancho: 0.2, alto: 0.2 } }),
      clase('Inscribe', {
        caja: { x: 0.4, y: 0.5, ancho: 0.2, alto: 0.15 },
        atributos: [
          { nombre: 'nota', tipo: 'decimal', visibilidad: '-', multiplicidad: null, esClave: false },
        ],
      }),
    ],
    relaciones: [
      relacion({
        tipo: 'association-class',
        origen: 'Usuario',
        destino: 'Materia',
        multiplicidadOrigen: '0..*',
        multiplicidadDestino: '0..*',
        claseAsociacion: 'Inscribe',
      }),
    ],
  }

  it('la clase colgante nace apuntando a su relación', () => {
    const resultado = construir(boceto)
    if (!resultado.ok) return

    const inscribe = Object.values(resultado.doc.nodes).find((n) => n.name === 'Inscribe')

    expect(inscribe?.kind).toBe('association-class')
    expect(inscribe?.associationId).not.toBeNull()
    expect(resultado.doc.edges[inscribe?.associationId ?? '']).toBeDefined()
  })

  it('genera UNA sola relación, no una asociación además de la clase', () => {
    const resultado = construir(boceto)
    if (!resultado.ok) return

    expect(Object.keys(resultado.doc.edges)).toHaveLength(1)
  })

  it('sin la clase colgante se degrada a una asociación normal', () => {
    const resultado = construir({
      clases: [clase('A'), clase('B', { caja: { x: 0.6, y: 0.1, ancho: 0.2, alto: 0.2 } })],
      relaciones: [relacion({ tipo: 'association-class', claseAsociacion: null })],
    })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(Object.values(resultado.doc.edges)[0]?.kind).toBe('association')
  })

  it('si la clase colgante quedó huérfana vuelve a ser una clase normal', () => {
    // Referencia a una clase que no está en la lista: el invariante §5.4.6 se rompería.
    const resultado = construir({
      clases: [clase('A'), clase('B', { caja: { x: 0.6, y: 0.1, ancho: 0.2, alto: 0.2 } })],
      relaciones: [relacion({ tipo: 'association-class', claseAsociacion: 'NoExiste' })],
    })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(Object.values(resultado.doc.nodes).every((n) => n.kind !== 'association-class')).toBe(true)
  })
})

describe('lo que el modelo puede devolver mal', () => {
  it('descarta una relación hacia una clase que no existe, y lo dice', () => {
    const resultado = construir({
      clases: [clase('A')],
      relaciones: [relacion({ origen: 'A', destino: 'Fantasma' })],
    })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(Object.keys(resultado.doc.edges)).toHaveLength(0)
    expect(resultado.avisos.some((a) => a.includes('Fantasma'))).toBe(true)
  })

  it('cambia un tipo de relación inventado por una asociación simple', () => {
    const resultado = construir({
      clases: [clase('A'), clase('B', { caja: { x: 0.6, y: 0.1, ancho: 0.2, alto: 0.2 } })],
      relaciones: [relacion({ tipo: 'telepatia' })],
    })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(Object.values(resultado.doc.edges)[0]?.kind).toBe('association')
    expect(resultado.avisos.some((a) => a.includes('telepatia'))).toBe(true)
  })

  it('avisa de los nombres repetidos en vez de generar ids colgando de la nada', () => {
    const resultado = construir({
      clases: [clase('A'), clase('A', { caja: { x: 0.6, y: 0.1, ancho: 0.2, alto: 0.2 } })],
      relaciones: [],
    })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(Object.keys(resultado.doc.nodes)).toHaveLength(2)
    expect(resultado.avisos.some((a) => a.includes('más de una clase'))).toBe(true)
  })

  it('acepta una visibilidad que no es ninguna de las cuatro', () => {
    const resultado = construir({
      clases: [
        clase('A', {
          atributos: [
            { nombre: 'x', tipo: 'int', visibilidad: '?', multiplicidad: null, esClave: false },
          ],
        }),
      ],
      relaciones: [],
    })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    const [nodo] = Object.values(resultado.doc.nodes)
    const atributo = (nodo?.compartments.attributes ?? [])[0]

    expect(atributo?.kind === 'property' && atributo.visibility).toBe('-')
  })

  it('una relación de una clase consigo misma es válida', () => {
    const resultado = construir({
      clases: [clase('Categoria')],
      relaciones: [relacion({ origen: 'Categoria', destino: 'Categoria' })],
    })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    const [arista] = Object.values(resultado.doc.edges)
    expect(arista?.source).toBe(arista?.target)
  })

  it('un boceto vacío da un documento vacío, no un error', () => {
    const resultado = construir({ clases: [], relaciones: [] })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(Object.keys(resultado.doc.nodes)).toHaveLength(0)
  })
})

describe('las posiciones', () => {
  it('respeta el orden del boceto: lo que está a la izquierda queda a la izquierda', () => {
    const { posiciones } = ubicar([
      clase('Izq', { caja: { x: 0.05, y: 0.1, ancho: 0.2, alto: 0.2 } }),
      clase('Der', { caja: { x: 0.7, y: 0.1, ancho: 0.2, alto: 0.2 } }),
    ])

    expect(posiciones[0]!.x).toBeLessThan(posiciones[1]!.x)
  })

  it('separa las cajas que el modelo puso encimadas', () => {
    const misma = { x: 0.1, y: 0.1, ancho: 0.2, alto: 0.2 }
    const { posiciones, avisos } = ubicar([
      clase('A', { caja: misma }),
      clase('B', { caja: { ...misma, x: 0.11 } }),
      clase('C', { caja: { ...misma, x: 0.12 } }),
    ])

    const distintas = new Set(posiciones.map((p) => `${p.x},${p.y}`))

    expect(distintas.size).toBe(3)
    expect(avisos.some((a) => a.includes('encimada'))).toBe(true)
  })

  it('cae a una rejilla cuando las coordenadas son inservibles', () => {
    const fuera = { x: 99, y: -50, ancho: 0, alto: 0 }
    const { posiciones, avisos } = ubicar([
      clase('A', { caja: fuera }),
      clase('B', { caja: fuera }),
      clase('C', { caja: fuera }),
    ])

    expect(avisos.some((a) => a.includes('rejilla'))).toBe(true)
    expect(new Set(posiciones.map((p) => `${p.x},${p.y}`)).size).toBe(3)
  })

  it('alinea todo a la rejilla de 8 px', () => {
    const { posiciones } = ubicar([
      clase('A', { caja: { x: 0.137, y: 0.291, ancho: 0.213, alto: 0.2 } }),
      clase('B', { caja: { x: 0.611, y: 0.077, ancho: 0.198, alto: 0.2 } }),
    ])

    for (const posicion of posiciones) {
      expect(posicion.x % 8).toBe(0)
      expect(posicion.y % 8).toBe(0)
      expect(posicion.ancho % 8).toBe(0)
    }
  })

  it('nunca deja una caja fuera del lienzo por la izquierda o por arriba', () => {
    const { posiciones } = ubicar([
      clase('A', { caja: { x: -0.3, y: -0.2, ancho: 0.2, alto: 0.2 } }),
      clase('B', { caja: { x: 0.5, y: 0.5, ancho: 0.2, alto: 0.2 } }),
    ])

    for (const posicion of posiciones) {
      expect(posicion.x).toBeGreaterThanOrEqual(0)
      expect(posicion.y).toBeGreaterThanOrEqual(0)
    }
  })
})
