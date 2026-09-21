import { beforeEach, describe, expect, it } from 'vitest'

import { ejecutarHerramienta, HERRAMIENTAS } from '@/voz/herramientas'
import { useDiagramStore } from '@/state/useDiagramStore'
import { createDocument, createEdge, createNode, createProperty } from '@/uml/model/factories'
import type { UmlDocument } from '@/uml/model/types'

/**
 * Las herramientas del agente de voz.
 *
 * Lo que hay que impedir aquí no es que fallen —un fallo vuelve como texto y el agente lo
 * cuenta— sino que hagan SILENCIOSAMENTE lo que no era: renombrar la clase parecida, borrar
 * sin preguntar, crear la relación al revés. El usuario está hablando, no mirando el lienzo.
 */

const store = useDiagramStore

/** Un videoclub reducido, con los casos que importan. */
function videoclub(): UmlDocument {
  const doc = createDocument({ name: 'Videoclub' })
  const diagramId = doc.diagrams[0]!.id

  const clase = (id: string, name: string, x: number, y: number) => {
    const nodo = createNode({
      id,
      kind: 'class',
      name,
      diagramId,
      position: { x, y },
      compartmentIds: ['attributes', 'operations'],
    })
    doc.nodes[id] = nodo
    return nodo
  }

  const pelicula = clase('n_peli', 'PELICULA', 0, 0)
  clase('n_actor', 'ACTOR', 400, 0)
  clase('n_socio', 'SOCIO', 800, 0)
  clase('n_ejemplar', 'Ejemplar', 0, 400)
  clase('n_nota', 'notaAlquiler', 400, 400)

  pelicula.compartments.attributes = [
    createProperty({ id: 'm_cod', name: 'codigo', type: 'String', isId: true }),
    createProperty({ id: 'm_tit', name: 'titulo', type: 'String' }),
  ]

  doc.edges.e_comp = createEdge({
    id: 'e_comp',
    kind: 'composition',
    diagramId,
    source: 'n_peli',
    target: 'n_ejemplar',
  })

  return doc
}

const doc = () => store.getState().doc
const clasePorNombre = (nombre: string) =>
  Object.values(doc().nodes).find((nodo) => nodo.name === nombre)

beforeEach(() => {
  store.getState().replaceDocument(videoclub())
})

describe('el registro que ve el agente', () => {
  it('cada herramienta anunciada existe de verdad', () => {
    for (const herramienta of HERRAMIENTAS) {
      const resultado = ejecutarHerramienta(herramienta.name, {})
      // Puede fallar por faltarle argumentos, pero nunca por no existir.
      expect(JSON.stringify(resultado), herramienta.name).not.toContain('No existe una herramienta')
    }
  })

  it('nunca lanza, por más basura que se le pase', () => {
    expect(() => ejecutarHerramienta('crear_clase', null)).not.toThrow()
    expect(() => ejecutarHerramienta('inventada', {})).not.toThrow()
    expect(ejecutarHerramienta('inventada', {}).ok).toBe(false)
  })
})

describe('leer el diagrama', () => {
  it('el resumen nombra las clases y no incluye ids ni posiciones', () => {
    const resultado = ejecutarHerramienta('resumen_diagrama', {})
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.mensaje).toContain('PELICULA')
    expect(resultado.mensaje).toContain('composición')

    // Lo que NO debe llevar: paga tokens en cada turno y no le sirve para nada.
    expect(resultado.mensaje).not.toContain('n_peli')
    expect(resultado.mensaje).not.toContain('position')
  })

  it('el detalle de una clase incluye sus relaciones', () => {
    const resultado = ejecutarHerramienta('detalle_clase', { clase: 'pelicula' })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.mensaje).toContain('codigo')
    expect(resultado.mensaje).toContain('Ejemplar')
  })
})

describe('crear y renombrar', () => {
  it('crea una clase y la coloca sin encimarla a ninguna', () => {
    const resultado = ejecutarHerramienta('crear_clase', { nombre: 'DIRECTOR' })
    expect(resultado.ok).toBe(true)

    const nueva = clasePorNombre('DIRECTOR')
    expect(nueva).toBeDefined()

    const otras = Object.values(doc().nodes).filter((nodo) => nodo.id !== nueva!.id)
    const encimada = otras.some(
      (otra) =>
        Math.abs(otra.position.x - nueva!.position.x) < 40 &&
        Math.abs(otra.position.y - nueva!.position.y) < 40,
    )
    expect(encimada).toBe(false)
  })

  it('coloca a la derecha cuando se lo piden', () => {
    ejecutarHerramienta('crear_clase', {
      nombre: 'DIRECTOR',
      cerca_de: 'SOCIO',
      direccion: 'derecha',
    })

    const socio = clasePorNombre('SOCIO')!
    const director = clasePorNombre('DIRECTOR')!

    expect(director.position.x).toBeGreaterThan(socio.position.x)
  })

  it('no crea una clase que ya existe', () => {
    const resultado = ejecutarHerramienta('crear_clase', { nombre: 'pelicula' })

    expect(resultado.ok).toBe(false)
    expect(Object.keys(doc().nodes)).toHaveLength(5)
  })

  it('renombra resolviendo el nombre como lo dijo el usuario', () => {
    const resultado = ejecutarHerramienta('renombrar_clase', {
      actual: 'nota alquiler',
      nuevo: 'NotaDeAlquiler',
    })

    expect(resultado.ok).toBe(true)
    expect(clasePorNombre('NotaDeAlquiler')).toBeDefined()
  })

  it('no renombra a un nombre que ya está tomado', () => {
    const resultado = ejecutarHerramienta('renombrar_clase', { actual: 'ACTOR', nuevo: 'SOCIO' })

    expect(resultado.ok).toBe(false)
    expect(clasePorNombre('ACTOR')).toBeDefined()
  })

  it('con un nombre que no existe lo dice, no inventa', () => {
    const resultado = ejecutarHerramienta('detalle_clase', { clase: 'Factura' })

    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.error).toContain('Factura')
  })
})

describe('borrar exige confirmación', () => {
  it('sin confirmar no borra nada y avisa de lo que se llevaría por delante', () => {
    const resultado = ejecutarHerramienta('eliminar_clase', { nombre: 'PELICULA' })

    expect(resultado.ok).toBe(false)
    if (!resultado.ok) {
      expect(resultado.error).toContain('relación')
      expect(resultado.error).toContain('confirmado')
    }

    // Lo que importa: sigue ahí.
    expect(clasePorNombre('PELICULA')).toBeDefined()
  })

  it('con confirmado borra la clase y sus relaciones', () => {
    const resultado = ejecutarHerramienta('eliminar_clase', {
      nombre: 'PELICULA',
      confirmado: true,
    })

    expect(resultado.ok).toBe(true)
    expect(clasePorNombre('PELICULA')).toBeUndefined()
    expect(doc().edges.e_comp).toBeUndefined()
  })

  it('una relación tampoco se borra sin confirmar', () => {
    const resultado = ejecutarHerramienta('eliminar_relacion', {
      origen: 'PELICULA',
      destino: 'Ejemplar',
    })

    expect(resultado.ok).toBe(false)
    expect(doc().edges.e_comp).toBeDefined()
  })
})

describe('atributos', () => {
  it('agrega con tipo y visibilidad', () => {
    ejecutarHerramienta('agregar_atributo', {
      clase: 'SOCIO',
      nombre: 'telefono',
      tipo: 'String',
      visibilidad: 'privado',
    })

    const socio = clasePorNombre('SOCIO')!
    const atributo = socio.compartments.attributes?.find((m) => m.name === 'telefono')

    expect(atributo).toBeDefined()
    expect(atributo?.kind).toBe('property')
    if (atributo?.kind === 'property') {
      expect(atributo.type).toBe('String')
      expect(atributo.visibility).toBe('-')
    }
  })

  it('no repite un atributo que ya está', () => {
    const resultado = ejecutarHerramienta('agregar_atributo', {
      clase: 'PELICULA',
      nombre: 'CODIGO',
    })

    expect(resultado.ok).toBe(false)
    expect(clasePorNombre('PELICULA')!.compartments.attributes).toHaveLength(2)
  })

  it('modifica el tipo de uno que existe', () => {
    ejecutarHerramienta('modificar_atributo', {
      clase: 'PELICULA',
      nombre: 'titulo',
      tipo: 'Texto',
    })

    const atributo = clasePorNombre('PELICULA')!.compartments.attributes?.find(
      (m) => m.name === 'titulo',
    )
    if (atributo?.kind === 'property') expect(atributo.type).toBe('Texto')
  })

  it('marcar la clave primaria funciona, que es de donde sale la PK al exportar', () => {
    ejecutarHerramienta('modificar_atributo', {
      clase: 'PELICULA',
      nombre: 'titulo',
      es_clave: true,
    })

    const atributo = clasePorNombre('PELICULA')!.compartments.attributes?.find(
      (m) => m.name === 'titulo',
    )
    if (atributo?.kind === 'property') expect(atributo.isId).toBe(true)
  })

  it('quita un atributo', () => {
    ejecutarHerramienta('quitar_atributo', { clase: 'PELICULA', nombre: 'titulo' })
    expect(clasePorNombre('PELICULA')!.compartments.attributes).toHaveLength(1)
  })
})

describe('relaciones', () => {
  it('crea una generalización con la subclase como origen', () => {
    ejecutarHerramienta('crear_relacion', {
      origen: 'ACTOR',
      destino: 'SOCIO',
      tipo: 'generalizacion',
    })

    const arista = Object.values(doc().edges).find((e) => e.kind === 'generalization')!
    expect(doc().nodes[arista.source]?.name).toBe('ACTOR')
    expect(doc().nodes[arista.target]?.name).toBe('SOCIO')
  })

  it('crea una asociación con sus multiplicidades', () => {
    ejecutarHerramienta('crear_relacion', {
      origen: 'SOCIO',
      destino: 'notaAlquiler',
      tipo: 'asociacion',
      multiplicidad_origen: '1',
      multiplicidad_destino: '1..*',
      nombre: 'realiza',
    })

    const arista = Object.values(doc().edges).find((e) => e.name === 'realiza')!
    expect(arista.ends.source.multiplicity).toBe('1')
    expect(arista.ends.target.multiplicity).toBe('1..*')
  })

  it('una clase de asociación nace con su clase colgando', () => {
    ejecutarHerramienta('crear_relacion', {
      origen: 'ACTOR',
      destino: 'PELICULA',
      tipo: 'clase de asociacion',
      clase_asociacion: 'Participa',
    })

    const arista = Object.values(doc().edges).find((e) => e.kind === 'association-class')!
    const clase = clasePorNombre('Participa')!

    expect(clase.kind).toBe('association-class')
    expect(clase.associationId).toBe(arista.id)
  })

  it('rechaza un tipo de relación que no existe', () => {
    const resultado = ejecutarHerramienta('crear_relacion', {
      origen: 'ACTOR',
      destino: 'SOCIO',
      tipo: 'amistad',
    })

    expect(resultado.ok).toBe(false)
  })

  it('no deja que una clase herede de sí misma', () => {
    const resultado = ejecutarHerramienta('crear_relacion', {
      origen: 'ACTOR',
      destino: 'actor',
      tipo: 'generalizacion',
    })

    expect(resultado.ok).toBe(false)
  })

  it('cambia la multiplicidad del extremo correcto aunque se nombren al revés', () => {
    /**
     * El usuario dice "la relación entre Ejemplar y PELICULA" sin pensar en cuál es el
     * origen. La herramienta tiene que poner la multiplicidad en el extremo de la clase que
     * el usuario nombró, no en el que está primero en el documento.
     */
    ejecutarHerramienta('modificar_relacion', {
      origen: 'Ejemplar',
      destino: 'PELICULA',
      multiplicidad_origen: '0..*',
    })

    const arista = doc().edges.e_comp!
    // En el documento, Ejemplar es el DESTINO de la composición.
    expect(arista.ends.target.multiplicity).toBe('0..*')
    expect(arista.ends.source.multiplicity).toBeNull()
  })
})

describe('deshacer', () => {
  it('revierte el último cambio del agente', () => {
    ejecutarHerramienta('crear_clase', { nombre: 'DIRECTOR' })
    expect(clasePorNombre('DIRECTOR')).toBeDefined()

    const resultado = ejecutarHerramienta('deshacer', {})

    expect(resultado.ok).toBe(true)
    expect(clasePorNombre('DIRECTOR')).toBeUndefined()
  })
})
