// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { documentToEa11 } from '@/io/xmi/ea11Escribir'
import { documentFromXmi } from '@/io/xmi/importXmi'
import { createFullSampleDocument } from '@/uml/model/fullSampleDocument'
import type { UmlDocument } from '@/uml/model/types'

/**
 * El dialecto que de verdad usa Enterprise Architect: XMI 1.1 con metamodelo UML 1.3.
 *
 * El fixture no es inventado: es un diagrama exportado desde la instalación de EA del
 * usuario, con su codificación windows-1252 y todo. Construir esto contra la especificación
 * de XMI 2.1 produjo un fichero que EA abría a medias —las clases entraban y el diagrama se
 * perdía— y ninguna cantidad de tests contra nuestro propio formato lo habría detectado.
 */

const XML_REAL = readFileSync('src/io/xmi/fixtures/ea-xmi11.xml', 'latin1')

const nombreDe = (doc: UmlDocument, id: string): string => doc.nodes[id]?.name ?? '?'

describe('leer un .xmi exportado por Enterprise Architect', () => {
  const resultado = documentFromXmi(XML_REAL, 'aran')

  it('se reconoce el dialecto y entra sin avisos', () => {
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.avisos).toEqual([])
  })

  it('trae las nueve clases del diagrama', () => {
    if (!resultado.ok) throw new Error(resultado.error)

    const nombres = Object.values(resultado.doc.nodes).map((nodo) => nodo.name).sort()
    expect(nombres).toEqual([
      'ACTOR',
      'DIRECTOR',
      'Ejemplar',
      'PELICULA',
      'PERSONA',
      'Participa',
      'SOCIO',
      'alquiler',
      'notaAlquiler',
    ])
  })

  it('no arrastra la clase técnica que EA mete en todo modelo', () => {
    if (!resultado.ok) throw new Error(resultado.error)

    const raiz = Object.values(resultado.doc.nodes).find((nodo) => nodo.name === 'EARootClass')
    expect(raiz).toBeUndefined()
  })

  it('coloca cada caja donde estaba', () => {
    if (!resultado.ok) throw new Error(resultado.error)

    const porNombre = (nombre: string) =>
      Object.values(resultado.doc.nodes).find((nodo) => nodo.name === nombre)

    // Left=429;Top=85;Right=519;Bottom=155;
    expect(porNombre('PERSONA')?.position).toEqual({ x: 429, y: 85 })
    expect(porNombre('PERSONA')?.size).toEqual({ width: 90, height: 70 })
    expect(porNombre('SOCIO')?.position).toEqual({ x: 655, y: 168 })
  })

  it('respeta el orden en que se escribieron los atributos', () => {
    if (!resultado.ok) throw new Error(resultado.error)

    // EA los guarda desordenados y pone el orden real en la etiqueta `position`.
    const pelicula = Object.values(resultado.doc.nodes).find((n) => n.name === 'PELICULA')!
    const nombres = (pelicula.compartments.attributes ?? []).map((a) => a.name)

    expect(nombres).toEqual(['codigo', 'titulo', 'nacionalidad', 'año', 'productora'])
  })

  it('lee las generalizaciones con la subclase como origen', () => {
    if (!resultado.ok) throw new Error(resultado.error)

    const herencias = Object.values(resultado.doc.edges)
      .filter((arista) => arista.kind === 'generalization')
      .map((arista) => `${nombreDe(resultado.doc, arista.source)}->${nombreDe(resultado.doc, arista.target)}`)
      .sort()

    expect(herencias).toEqual(['ACTOR->PERSONA', 'DIRECTOR->PERSONA'])
  })

  it('lee la composición con el todo como origen', () => {
    if (!resultado.ok) throw new Error(resultado.error)

    const composicion = Object.values(resultado.doc.edges).find((a) => a.kind === 'composition')
    expect(composicion).toBeDefined()

    /**
     * Aquí está el convenio opuesto. UML 1.3 marca `aggregation` en el extremo del TODO;
     * UML 2.x lo marca en el de la parte. Leer esto con la regla de UML 2 da la composición
     * invertida: un modelo que abre sin errores y que, exportado a Spring, borraría las
     * películas al borrar una copia.
     */
    expect(nombreDe(resultado.doc, composicion!.source)).toBe('PELICULA')
    expect(nombreDe(resultado.doc, composicion!.target)).toBe('Ejemplar')
  })

  it('lee la relación de SOCIO consigo mismo', () => {
    if (!resultado.ok) throw new Error(resultado.error)

    const bucle = Object.values(resultado.doc.edges).find((a) => a.source === a.target)
    expect(bucle).toBeDefined()
    expect(nombreDe(resultado.doc, bucle!.source)).toBe('SOCIO')
    expect(bucle!.ends.source.multiplicity).toBe('0..*')
    expect(bucle!.ends.target.multiplicity).toBe('1..1')
  })

  it('cuelga cada clase de asociación de su relación', () => {
    if (!resultado.ok) throw new Error(resultado.error)

    const colgantes = Object.values(resultado.doc.nodes).filter(
      (nodo) => nodo.kind === 'association-class',
    )

    expect(colgantes.map((nodo) => nodo.name).sort()).toEqual(['Participa', 'alquiler'])

    for (const nodo of colgantes) {
      const arista = resultado.doc.edges[nodo.associationId ?? '']
      expect(arista, `${nodo.name} sin su relación`).toBeDefined()
      expect(arista!.kind).toBe('association-class')
    }
  })

  it('conserva el nombre y las multiplicidades de una asociación', () => {
    if (!resultado.ok) throw new Error(resultado.error)

    const realiza = Object.values(resultado.doc.edges).find((a) => a.name === 'realiza')
    expect(realiza).toBeDefined()
    expect(nombreDe(resultado.doc, realiza!.source)).toBe('SOCIO')
    expect(nombreDe(resultado.doc, realiza!.target)).toBe('notaAlquiler')
    expect(realiza!.ends.source.multiplicity).toBe('1..1')
    expect(realiza!.ends.target.multiplicity).toBe('1..*')
  })
})

describe('escribir en el dialecto de EA', () => {
  const original = createFullSampleDocument()
  const texto = documentToEa11(original)

  it('produce XMI 1.1 con el metamodelo UML 1.3', () => {
    expect(texto).toContain('xmi.version="1.1"')
    expect(texto).toContain('omg.org/UML1.3')
  })

  it('pone el diagrama dentro del contenido, no en una extensión', () => {
    // Es la diferencia que hacía que EA importara las clases y perdiera la distribución.
    const contenido = texto.slice(texto.indexOf('<XMI.content>'), texto.indexOf('</XMI.content>'))
    expect(contenido).toContain('<UML:Diagram')
    expect(contenido).toContain('<UML:DiagramElement')
  })

  it('escribe una geometría por cada clase', () => {
    const cajas = [...texto.matchAll(/geometry="Left=/g)]
    expect(cajas).toHaveLength(Object.keys(original.nodes).length)
  })

  it('marca la agregación en el extremo del todo, que es el origen', () => {
    const composicion = Object.values(original.edges).find((a) => a.kind === 'composition')!
    const trozo = texto.slice(texto.indexOf(`ea_sourceName" value="${
      original.nodes[composicion.source]!.name
    }"`))

    const primerExtremo = trozo.slice(0, trozo.indexOf('ea_end'))
    expect(primerExtremo).toContain('aggregation="composite"')
  })

  it('vuelve a leerse como XML válido', () => {
    const doc = new DOMParser().parseFromString(texto, 'application/xml')
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
  })
})

describe('ida y vuelta por el dialecto de EA', () => {
  const original = createFullSampleDocument()
  const vuelta = documentFromXmi(documentToEa11(original), original.meta.name)

  it('vuelve el mismo documento', () => {
    expect(vuelta.ok).toBe(true)
    if (!vuelta.ok) return

    expect(Object.keys(vuelta.doc.nodes).sort()).toEqual(Object.keys(original.nodes).sort())
    expect(Object.keys(vuelta.doc.edges).sort()).toEqual(Object.keys(original.edges).sort())
  })

  it('no invierte ni reclasifica ninguna relación', () => {
    if (!vuelta.ok) throw new Error(vuelta.error)

    for (const [id, arista] of Object.entries(original.edges)) {
      expect(vuelta.doc.edges[id]?.kind, `tipo de ${id}`).toBe(arista.kind)
      expect(vuelta.doc.edges[id]?.source, `origen de ${id}`).toBe(arista.source)
      expect(vuelta.doc.edges[id]?.target, `destino de ${id}`).toBe(arista.target)
    }
  })

  it('conserva posiciones y tamaños', () => {
    if (!vuelta.ok) throw new Error(vuelta.error)

    for (const [id, nodo] of Object.entries(original.nodes)) {
      expect(vuelta.doc.nodes[id]?.position, `posición de ${nodo.name}`).toEqual(nodo.position)
      expect(vuelta.doc.nodes[id]?.size, `tamaño de ${nodo.name}`).toEqual(nodo.size)
    }
  })

  it('conserva los atributos con su tipo y su multiplicidad', () => {
    if (!vuelta.ok) throw new Error(vuelta.error)

    for (const [id, nodo] of Object.entries(original.nodes)) {
      const antes = (nodo.compartments.attributes ?? []).map((a) =>
        a.kind === 'property' ? [a.name, a.type, a.multiplicity, a.isId] : null,
      )
      const ahora = (vuelta.doc.nodes[id]?.compartments.attributes ?? []).map((a) =>
        a.kind === 'property' ? [a.name, a.type, a.multiplicity, a.isId] : null,
      )

      expect(ahora, `atributos de ${nodo.name}`).toEqual(antes)
    }
  })

  it('conserva la clase de asociación enganchada a su relación', () => {
    if (!vuelta.ok) throw new Error(vuelta.error)

    const conClase = Object.values(original.nodes).find((nodo) => nodo.associationId !== null)!
    expect(vuelta.doc.nodes[conClase.id]?.associationId).toBe(conClase.associationId)
  })
})
