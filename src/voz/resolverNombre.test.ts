import { describe, expect, it } from 'vitest'

import { normalizar, resolverNodo, resolverPorNombre } from '@/voz/resolverNombre'
import { createDocument, createNode } from '@/uml/model/factories'
import type { UmlDocument } from '@/uml/model/types'

/**
 * Resolver un nombre dicho en voz alta.
 *
 * El fallo que hay que evitar no es "no encuentro la clase" —eso el agente lo pregunta— sino
 * encontrar la EQUIVOCADA con seguridad. Renombrar PELICULA cuando el usuario dijo PELICULAS
 * es un error que el usuario no ve venir, así que ante la duda estos tests exigen ambigüedad,
 * no acierto.
 */

const conClases = (...nombres: string[]): UmlDocument => {
  const doc = createDocument({ name: 'Videoclub' })

  for (const nombre of nombres) {
    const nodo = createNode({
      kind: 'class',
      name: nombre,
      position: { x: 0, y: 0 },
      compartmentIds: ['attributes', 'operations'],
    })
    doc.nodes[nodo.id] = nodo
  }

  return doc
}

describe('normalizar', () => {
  it('quita acentos, mayúsculas y espacios', () => {
    expect(normalizar('PELÍCULA')).toBe('pelicula')
    expect(normalizar('nota Alquiler')).toBe('notaalquiler')
    expect(normalizar('  Socio  ')).toBe('socio')
  })
})

describe('lo que el reconocimiento de voz le hace a un nombre', () => {
  const doc = conClases('PELICULA', 'ACTOR', 'SOCIO', 'notaAlquiler', 'Ejemplar')

  const nombreDe = (texto: string) => {
    const r = resolverNodo(doc, texto)
    return r.tipo === 'uno' ? r.valor.name : r.tipo
  }

  it('acierta con mayúsculas distintas', () => {
    expect(nombreDe('pelicula')).toBe('PELICULA')
    expect(nombreDe('Pelicula')).toBe('PELICULA')
  })

  it('acierta con acentos que el dictado añade', () => {
    expect(nombreDe('película')).toBe('PELICULA')
    expect(nombreDe('PELÍCULA')).toBe('PELICULA')
  })

  it('acierta con palabras separadas', () => {
    // "notaAlquiler" se dicta como dos palabras casi siempre.
    expect(nombreDe('nota alquiler')).toBe('notaAlquiler')
  })

  it('tolera una letra de más o de menos en nombres largos', () => {
    expect(nombreDe('notaAlquileres')).toBe('notaAlquiler')
    expect(nombreDe('ejemplarr')).toBe('Ejemplar')
  })

  it('no inventa una coincidencia para algo que no está', () => {
    expect(nombreDe('DIRECTOR')).toBe('ninguno')
    expect(nombreDe('')).toBe('ninguno')
  })
})

describe('ante la duda no elige', () => {
  it('devuelve los candidatos cuando dos clases se parecen', () => {
    const doc = conClases('Pedido', 'PedidoLinea')
    const resultado = resolverNodo(doc, 'pedido')

    // "Pedido" es exacto y "PedidoLinea" solo empieza igual: gana el exacto, sin preguntar.
    expect(resultado.tipo).toBe('uno')
    if (resultado.tipo === 'uno') expect(resultado.valor.name).toBe('Pedido')
  })

  it('pregunta cuando ninguna es exacta y varias encajan', () => {
    const doc = conClases('PedidoLinea', 'PedidoCabecera')
    const resultado = resolverNodo(doc, 'pedido')

    expect(resultado.tipo).toBe('varios')
    if (resultado.tipo === 'varios') {
      expect(resultado.candidatos.sort()).toEqual(['PedidoCabecera', 'PedidoLinea'])
    }
  })

  it('una coincidencia exacta nunca compite con una aproximada', () => {
    // Sin esto, "Socio" podría acabar resuelto como "Socios" por parecerse lo mismo.
    const doc = conClases('Socio', 'Socios')
    const resultado = resolverNodo(doc, 'Socio')

    expect(resultado.tipo).toBe('uno')
    if (resultado.tipo === 'uno') expect(resultado.valor.name).toBe('Socio')
  })

  it('en nombres cortos no tolera erratas, porque casi todo se parece', () => {
    const doc = conClases('Rol', 'Sol')
    expect(resolverNodo(doc, 'Col').tipo).toBe('ninguno')
  })
})

describe('sirve para cualquier lista con nombre', () => {
  it('resuelve atributos igual que clases', () => {
    const atributos = [{ name: 'fechaDev' }, { name: 'penal' }, { name: 'nro' }]
    const resultado = resolverPorNombre('fecha dev', atributos, (a) => a.name)

    expect(resultado.tipo).toBe('uno')
    if (resultado.tipo === 'uno') expect(resultado.valor.name).toBe('fechaDev')
  })
})
