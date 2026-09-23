// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { documentToXmi } from '@/io/xmi/exportXmi'
import { documentFromXmi } from '@/io/xmi/importXmi'
import { createFullSampleDocument } from '@/uml/model/fullSampleDocument'
import type { UmlDocument } from '@/uml/model/types'

/**
 * La ida y vuelta por XMI 2.1.
 *
 * Se compara por NOMBRE y no por id a propósito. El fichero que se le da a Enterprise
 * Architect no lleva ninguna tabla que traduzca sus identificadores a los nuestros: llevarla
 * obligaba a meter un elemento ajeno en el XMI, y su importador descarta lo que contiene algo
 * que no reconoce —fue justo lo que dejaba el diagrama sin colocar—. Así que una vuelta por
 * EA devuelve el mismo diagrama con identificadores nuevos, y lo que hay que garantizar es
 * que no se pierde ni se invierte nada.
 *
 * El fallo que de verdad duele en un formato de intercambio no es que reviente —eso se ve—
 * sino que se pierda una arista o se invierta una dirección en silencio: el fichero abre, el
 * diagrama se ve casi igual, y el backend generado a partir de él significa otra cosa.
 */

const ida = (documento: UmlDocument): UmlDocument => {
  const resultado = documentFromXmi(documentToXmi(documento), documento.meta.name)
  if (!resultado.ok) throw new Error(`no se pudo reimportar: ${resultado.error}`)

  return resultado.doc
}

const porNombre = (doc: UmlDocument, nombre: string) =>
  Object.values(doc.nodes).find((nodo) => nodo.name === nombre)

/** Una relación descrita sin ids, que es lo que se puede comparar entre las dos vueltas. */
const relaciones = (doc: UmlDocument): string[] => {
  const nombre = (id: string) => doc.nodes[id]?.name ?? '?'

  return Object.values(doc.edges)
    .map(
      (arista) =>
        `${arista.kind} ${nombre(arista.source)}[${arista.ends.source.multiplicity ?? '.'}` +
        `${arista.ends.source.role === null ? '' : ` ${arista.ends.source.role}`}]` +
        `->[${arista.ends.target.multiplicity ?? '.'}` +
        `${arista.ends.target.role === null ? '' : ` ${arista.ends.target.role}`}]` +
        `${nombre(arista.target)}${arista.name === null ? '' : ` "${arista.name}"`}`,
    )
    .sort()
}

describe('ida y vuelta con el documento de referencia', () => {
  const original = createFullSampleDocument()
  const vuelta = ida(original)

  it('no pierde ni inventa elementos', () => {
    expect(Object.keys(vuelta.nodes)).toHaveLength(Object.keys(original.nodes).length)
    expect(Object.keys(vuelta.edges)).toHaveLength(Object.keys(original.edges).length)
  })

  it('conserva las clases con su tipo, nombre y abstracción', () => {
    for (const nodo of Object.values(original.nodes)) {
      const copia = porNombre(vuelta, nodo.name)

      expect(copia, `falta ${nodo.name}`).toBeDefined()
      expect(copia!.kind, nodo.name).toBe(nodo.kind)
      expect(copia!.isAbstract, nodo.name).toBe(nodo.isAbstract)
      expect(copia!.visibility, nodo.name).toBe(nodo.visibility)
    }
  })

  it('no invierte ninguna relación ni cambia su tipo', () => {
    expect(relaciones(vuelta)).toEqual(relaciones(original))
  })

  it('conserva dónde está dibujada cada caja', () => {
    /**
     * Las coordenadas se trasladan al exportar para que ninguna caiga en negativo, que EA no
     * admite. Lo que tiene que sobrevivir es la posición RELATIVA: el dibujo es el mismo
     * trasladado en bloque, no uno distinto.
     */
    const nodos = Object.values(original.nodes)
    const minX = Math.min(...nodos.map((nodo) => nodo.position.x), 0)
    const minY = Math.min(...nodos.map((nodo) => nodo.position.y), 0)

    for (const nodo of nodos) {
      const copia = porNombre(vuelta, nodo.name)!

      expect(copia.position.x - nodo.position.x, `x de ${nodo.name}`).toBe(20 - minX)
      expect(copia.position.y - nodo.position.y, `y de ${nodo.name}`).toBe(20 - minY)
      expect(copia.size.width, `ancho de ${nodo.name}`).toBe(nodo.size.width)
    }
  })

  it('conserva los atributos con su tipo, multiplicidad y {id}', () => {
    for (const nodo of Object.values(original.nodes)) {
      const resumen = (lista: typeof nodo.compartments.attributes) =>
        (lista ?? []).map((miembro) =>
          miembro.kind === 'property'
            ? [miembro.name, miembro.type, miembro.multiplicity, miembro.isId]
            : null,
        )

      expect(
        resumen(porNombre(vuelta, nodo.name)!.compartments.attributes),
        `atributos de ${nodo.name}`,
      ).toEqual(resumen(nodo.compartments.attributes))
    }
  })

  it('conserva las operaciones con sus parámetros', () => {
    for (const nodo of Object.values(original.nodes)) {
      const resumen = (lista: typeof nodo.compartments.operations) =>
        (lista ?? []).map((miembro) =>
          miembro.kind === 'operation'
            ? [
                miembro.name,
                miembro.returnType,
                miembro.parameters.filter((p) => p.direction !== 'return').map((p) => p.name),
              ]
            : null,
        )

      expect(
        resumen(porNombre(vuelta, nodo.name)!.compartments.operations),
        `operaciones de ${nodo.name}`,
      ).toEqual(resumen(nodo.compartments.operations))
    }
  })

  it('la clase de asociación vuelve a colgar de su relación', () => {
    const conClase = Object.values(original.nodes).find((nodo) => nodo.associationId !== null)!
    const copia = porNombre(vuelta, conClase.name)!

    expect(copia.kind).toBe('association-class')
    expect(copia.associationId).not.toBeNull()
    expect(vuelta.edges[copia.associationId!]).toBeDefined()
    expect(vuelta.edges[copia.associationId!]!.kind).toBe('association-class')
  })

  it('el nombre de la clase de asociación no se duplica en la relación', () => {
    // El elemento XMI es uno solo y lleva un único nombre: el de la clase. Copiarlo también
    // a la arista lo pintaría dos veces en el lienzo.
    const conClase = Object.values(original.nodes).find((nodo) => nodo.associationId !== null)!
    const copia = porNombre(vuelta, conClase.name)!

    expect(vuelta.edges[copia.associationId!]!.name).toBeNull()
  })
})

/**
 * El censo de `<xmi:Extension>`, que es de donde Enterprise Architect reconstruye su modelo.
 *
 * La ida y vuelta de arriba no cubre esto: nuestro lector saca el tipo del `<type>` de
 * `ownedAttribute`, así que el roundtrip pasaba en verde mientras EA abría todas las clases
 * con los campos sin tipo. Por eso aquí se afirma contra el TEXTO del fichero y no contra lo
 * que devuelve nuestro propio importador.
 */
describe('el censo que lee Enterprise Architect', () => {
  const original = createFullSampleDocument()
  const xmi = documentToXmi(original)

  /** `nombre:tipo` de cada `<attribute>` del censo, con `-` cuando no lleva tipo. */
  const censoDelFichero = (): string[] =>
    (xmi.match(/<attribute [^>]*>[\s\S]*?<\/attribute>/g) ?? [])
      .map((bloque) => {
        const nombre = /<attribute [^>]*name="([^"]*)"/.exec(bloque)?.[1] ?? '?'
        const tipo = /<properties [^>]*\btype="([^"]*)"/.exec(bloque)?.[1] ?? null

        return `${nombre}:${tipo ?? '-'}`
      })
      .sort()

  const censoDelModelo = (): string[] =>
    Object.values(original.nodes)
      .flatMap((nodo) => nodo.compartments.attributes ?? [])
      .filter((miembro) => miembro.kind === 'property')
      .map((miembro) => {
        const tipo = miembro.kind === 'property' ? miembro.type : null

        return `${miembro.name}:${tipo === null || tipo.trim() === '' ? '-' : tipo.trim()}`
      })
      .sort()

  it('lleva el tipo de cada atributo en <properties type="…">', () => {
    expect(censoDelModelo().some((entrada) => !entrada.endsWith(':-'))).toBe(true)
    expect(censoDelFichero()).toEqual(censoDelModelo())
  })
})

/**
 * Lo que NO sobrevive, dicho a propósito.
 *
 * Son decisiones, no descuidos: si mañana alguien las arregla, estos tests fallan y le
 * obligan a venir aquí a cambiar el acuerdo en vez de dejarlo a medias.
 */
describe('pérdidas conocidas', () => {
  const original = createFullSampleDocument()
  const vuelta = ida(original)

  it('los identificadores se renuevan: el fichero de EA no lleva tabla de equivalencias', () => {
    const conocidos = new Set(Object.keys(original.nodes))
    const ahora = Object.keys(vuelta.nodes)

    expect(ahora.some((id) => conocidos.has(id))).toBe(false)
  })

  it('un parámetro de retorno se funde con el returnType, porque UML tiene uno solo', () => {
    const conRetorno = Object.values(original.nodes)
      .flatMap((nodo) => nodo.compartments.operations ?? [])
      .find(
        (miembro) =>
          miembro.kind === 'operation' &&
          miembro.parameters.some((parametro) => parametro.direction === 'return'),
      )

    expect(conRetorno).toBeDefined()
    if (conRetorno?.kind !== 'operation') return

    const copia = Object.values(vuelta.nodes)
      .flatMap((nodo) => nodo.compartments.operations ?? [])
      .find((miembro) => miembro.kind === 'operation' && miembro.name === conRetorno.name)

    if (copia?.kind !== 'operation') throw new Error('no se encontró la operación')

    expect(copia.returnType).toBe(conRetorno.returnType)
    expect(copia.parameters.some((parametro) => parametro.direction === 'return')).toBe(false)
  })
})
