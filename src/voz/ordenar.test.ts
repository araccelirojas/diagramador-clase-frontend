import { describe, expect, it } from 'vitest'

import { calcularDisposicion } from '@/voz/ordenar'
import { createDocument, createEdge, createNode } from '@/uml/model/factories'
import type { UmlDocument } from '@/uml/model/types'

/**
 * La colocación automática.
 *
 * Es lo que ejecuta el agente cuando le decís "ordená esto". Lo que hay que garantizar no es
 * que quede bonito —eso lo juzga el ojo— sino lo que se puede comprobar: que ninguna caja
 * acabe encima de otra y que una subclase nunca quede por encima de su superclase, porque un
 * diagrama de clases con la herencia al revés se lee mal aunque no se solape nada.
 */

const ANCHO = 200
const ALTO = 110

function construir(
  clases: string[],
  relaciones: Array<[string, string, string]> = [],
): UmlDocument {
  const doc = createDocument({ name: 'Prueba' })
  const diagramId = doc.diagrams[0]!.id

  for (const nombre of clases) {
    // Todas amontonadas en el mismo sitio: el desorden del que se parte.
    const nodo = createNode({
      id: `n_${nombre}`,
      kind: 'class',
      name: nombre,
      diagramId,
      position: { x: 0, y: 0 },
      size: { width: ANCHO, height: ALTO },
      compartmentIds: ['attributes', 'operations'],
    })
    doc.nodes[nodo.id] = nodo
  }

  for (const [origen, destino, kind] of relaciones) {
    const arista = createEdge({
      kind,
      diagramId,
      source: `n_${origen}`,
      target: `n_${destino}`,
    })
    doc.edges[arista.id] = arista
  }

  return doc
}

/** Si dos cajas comparten algún punto, con un margen de respeto. */
const seEnciman = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  margen = 0,
): boolean =>
  a.x < b.x + ANCHO + margen &&
  a.x + ANCHO + margen > b.x &&
  a.y < b.y + ALTO + margen &&
  a.y + ALTO + margen > b.y

describe('ninguna caja queda encima de otra', () => {
  it('con un diagrama entero amontonado en el origen', () => {
    const doc = construir(
      ['PERSONA', 'ACTOR', 'DIRECTOR', 'PELICULA', 'SOCIO', 'Ejemplar', 'notaAlquiler'],
      [
        ['ACTOR', 'PERSONA', 'generalization'],
        ['DIRECTOR', 'PERSONA', 'generalization'],
        ['PELICULA', 'Ejemplar', 'composition'],
        ['DIRECTOR', 'PELICULA', 'association'],
        ['notaAlquiler', 'SOCIO', 'association'],
      ],
    )

    const posiciones = [...calcularDisposicion(doc).values()]
    expect(posiciones).toHaveLength(7)

    for (let i = 0; i < posiciones.length; i += 1) {
      for (let j = i + 1; j < posiciones.length; j += 1) {
        expect(seEnciman(posiciones[i]!, posiciones[j]!), `${i} con ${j}`).toBe(false)
      }
    }
  })

  it('con clases sueltas, sin ninguna relación', () => {
    const doc = construir(['A', 'B', 'C', 'D', 'E'])
    const posiciones = [...calcularDisposicion(doc).values()]

    for (let i = 0; i < posiciones.length; i += 1) {
      for (let j = i + 1; j < posiciones.length; j += 1) {
        expect(seEnciman(posiciones[i]!, posiciones[j]!)).toBe(false)
      }
    }
  })
})

describe('la herencia se lee de arriba abajo', () => {
  it('la superclase queda por encima de sus subclases', () => {
    const doc = construir(
      ['PERSONA', 'ACTOR', 'DIRECTOR'],
      [
        ['ACTOR', 'PERSONA', 'generalization'],
        ['DIRECTOR', 'PERSONA', 'generalization'],
      ],
    )

    const posiciones = calcularDisposicion(doc)

    // En el lienzo la Y crece hacia abajo: menor Y es "más arriba".
    expect(posiciones.get('n_PERSONA')!.y).toBeLessThan(posiciones.get('n_ACTOR')!.y)
    expect(posiciones.get('n_PERSONA')!.y).toBeLessThan(posiciones.get('n_DIRECTOR')!.y)
  })

  it('aguanta tres niveles de herencia', () => {
    const doc = construir(
      ['Base', 'Media', 'Hoja'],
      [
        ['Media', 'Base', 'generalization'],
        ['Hoja', 'Media', 'generalization'],
      ],
    )

    const posiciones = calcularDisposicion(doc)

    expect(posiciones.get('n_Base')!.y).toBeLessThan(posiciones.get('n_Media')!.y)
    expect(posiciones.get('n_Media')!.y).toBeLessThan(posiciones.get('n_Hoja')!.y)
  })

  it('no se cuelga con una herencia circular', () => {
    // No es UML válido, pero un documento importado puede traerla y no puede colgar el
    // navegador a mitad de una llamada.
    const doc = construir(
      ['A', 'B'],
      [
        ['A', 'B', 'generalization'],
        ['B', 'A', 'generalization'],
      ],
    )

    expect(() => calcularDisposicion(doc)).not.toThrow()
    expect(calcularDisposicion(doc).size).toBe(2)
  })
})

describe('las clases de asociación van junto a su relación', () => {
  it('se coloca entre las dos clases que une, sin encimarse', () => {
    const doc = construir(['ACTOR', 'PELICULA'], [['ACTOR', 'PELICULA', 'association-class']])

    const arista = Object.values(doc.edges)[0]!
    const colgante = createNode({
      id: 'n_Participa',
      kind: 'association-class',
      name: 'Participa',
      diagramId: doc.diagrams[0]!.id,
      position: { x: 0, y: 0 },
      size: { width: ANCHO, height: ALTO },
      compartmentIds: ['attributes', 'operations'],
      associationId: arista.id,
    })
    doc.nodes[colgante.id] = colgante

    const posiciones = calcularDisposicion(doc)
    const participa = posiciones.get('n_Participa')!

    expect(participa).toBeDefined()

    for (const id of ['n_ACTOR', 'n_PELICULA']) {
      expect(seEnciman(participa, posiciones.get(id)!), id).toBe(false)
    }
  })
})

describe('casos de borde', () => {
  it('un diagrama vacío no devuelve nada, y no revienta', () => {
    expect(calcularDisposicion(createDocument({ name: 'Vacío' })).size).toBe(0)
  })

  it('una sola clase queda en un sitio visible, no en negativo', () => {
    const posiciones = calcularDisposicion(construir(['Sola']))
    const sola = posiciones.get('n_Sola')!

    expect(sola.x).toBeGreaterThanOrEqual(0)
    expect(sola.y).toBeGreaterThanOrEqual(0)
  })

  it('una relación de una clase consigo misma no afecta a la colocación', () => {
    const doc = construir(['SOCIO', 'OTRA'], [['SOCIO', 'SOCIO', 'association']])

    expect(() => calcularDisposicion(doc)).not.toThrow()
    expect(calcularDisposicion(doc).size).toBe(2)
  })
})
