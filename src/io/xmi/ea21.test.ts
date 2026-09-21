// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { documentFromXmi } from '@/io/xmi/importXmi'
import type { UmlDocument } from '@/uml/model/types'

/**
 * El mismo diagrama, exportado por Enterprise Architect en sus DOS dialectos.
 *
 * Los dos ficheros salen del mismo modelo en la misma instalación, así que tienen que
 * producir el mismo documento. Es la prueba más dura que hay aquí: no compara nuestro
 * lector contra lo que nosotros escribimos —que es fácil de hacer cuadrar— sino contra otra
 * lectura independiente del mismo original.
 */

const XMI_11 = readFileSync('src/io/xmi/fixtures/ea-xmi11.xml', 'latin1')
const XMI_21 = readFileSync('src/io/xmi/fixtures/ea-xmi21.xmi', 'latin1')

const leer = (texto: string): UmlDocument => {
  const resultado = documentFromXmi(texto, 'aran')
  if (!resultado.ok) throw new Error(resultado.error)

  return resultado.doc
}

/** Las relaciones como texto legible, que es lo que se puede comparar entre dialectos. */
function relacionesDe(doc: UmlDocument): string[] {
  const nombre = (id: string) => doc.nodes[id]?.name ?? '?'

  // `1` y `1..1` son la misma multiplicidad escrita de dos formas: un dialecto la guarda
  // como texto y el otro la calcula a partir de sus dos límites.
  const mult = (valor: string | null) => (valor === null ? '.' : valor === '1..1' ? '1' : valor)

  return Object.values(doc.edges)
    .map(
      (arista) =>
        `${arista.kind} ${nombre(arista.source)}[${mult(arista.ends.source.multiplicity)}]` +
        `->[${mult(arista.ends.target.multiplicity)}]${nombre(arista.target)}` +
        (arista.name === null ? '' : ` "${arista.name}"`),
    )
    .sort()
}

describe('leer el .xmi 2.1 de Enterprise Architect', () => {
  const doc = leer(XMI_21)

  it('trae las nueve clases con sus posiciones', () => {
    expect(Object.keys(doc.nodes)).toHaveLength(9)

    const porNombre = (nombre: string) => Object.values(doc.nodes).find((n) => n.name === nombre)
    expect(porNombre('PERSONA')?.position).toEqual({ x: 429, y: 85 })
    expect(porNombre('SOCIO')?.position).toEqual({ x: 655, y: 168 })
  })

  it('traduce el infinito, que EA escribe como -1', () => {
    // `upperValue value="-1"` es "sin límite". Tomarlo al pie de la letra daba "0..-1".
    const multiplicidades = Object.values(doc.edges).flatMap((arista) => [
      arista.ends.source.multiplicity,
      arista.ends.target.multiplicity,
    ])

    expect(multiplicidades.some((m) => m?.includes('-1'))).toBe(false)
    expect(multiplicidades).toContain('1..*')
  })

  it('no invierte las relaciones pese al orden de memberEnd', () => {
    /**
     * EA escribe `<memberEnd>` con el destino PRIMERO. Deducir el origen de ese orden
     * invertía cuatro de las ocho relaciones de este diagrama, en silencio.
     */
    const nombre = (id: string) => doc.nodes[id]?.name ?? '?'
    const realiza = Object.values(doc.edges).find((a) => a.name === 'realiza')!

    expect(nombre(realiza.source)).toBe('SOCIO')
    expect(nombre(realiza.target)).toBe('notaAlquiler')
  })

  it('lee la composición con el todo como origen', () => {
    const nombre = (id: string) => doc.nodes[id]?.name ?? '?'
    const composicion = Object.values(doc.edges).find((a) => a.kind === 'composition')!

    expect(nombre(composicion.source)).toBe('PELICULA')
    expect(nombre(composicion.target)).toBe('Ejemplar')
  })

  it('reconoce las dos clases de asociación', () => {
    const colgantes = Object.values(doc.nodes)
      .filter((nodo) => nodo.kind === 'association-class')
      .map((nodo) => nodo.name)
      .sort()

    expect(colgantes).toEqual(['Participa', 'alquiler'])
  })
})

describe('los dos dialectos describen el mismo diagrama', () => {
  const desde11 = leer(XMI_11)
  const desde21 = leer(XMI_21)

  it('las mismas clases', () => {
    const nombres = (doc: UmlDocument) => Object.values(doc.nodes).map((n) => n.name).sort()
    expect(nombres(desde21)).toEqual(nombres(desde11))
  })

  it('las mismas posiciones', () => {
    const cajas = (doc: UmlDocument) =>
      Object.values(doc.nodes)
        .map((n) => `${n.name} ${n.position.x},${n.position.y} ${n.size.width}x${n.size.height}`)
        .sort()

    expect(cajas(desde21)).toEqual(cajas(desde11))
  })

  it('las mismas relaciones, en el mismo sentido y con las mismas multiplicidades', () => {
    expect(relacionesDe(desde21)).toEqual(relacionesDe(desde11))
  })

  it('las mismas clases de asociación colgando de la misma relación', () => {
    const colgantes = (doc: UmlDocument) =>
      Object.values(doc.nodes)
        .filter((nodo) => nodo.associationId !== null)
        .map((nodo) => {
          const arista = doc.edges[nodo.associationId!]!
          return `${nodo.name} sobre ${doc.nodes[arista.source]?.name}-${doc.nodes[arista.target]?.name}`
        })
        .sort()

    expect(colgantes(desde21)).toEqual(colgantes(desde11))
  })
})

describe('lo que el dialecto 2.1 de EA no guarda', () => {
  it('el orden en que se escribieron los atributos', () => {
    const atributos = (doc: UmlDocument) =>
      (Object.values(doc.nodes).find((n) => n.name === 'PELICULA')?.compartments.attributes ?? [])
        .map((a) => a.name)

    // En 1.1 EA guarda la posición real de cada atributo; en 2.1 no la escribe, y salen
    // alfabéticos. No es un fallo del lector: esa información no está en el fichero.
    expect(atributos(leer(XMI_11))).toEqual([
      'codigo',
      'titulo',
      'nacionalidad',
      'año',
      'productora',
    ])
    expect(atributos(leer(XMI_21))).toEqual([
      'año',
      'codigo',
      'nacionalidad',
      'productora',
      'titulo',
    ])
  })
})
