import type { UmlDocument, UmlNode } from '@/uml/model/types'

/**
 * De un nombre dicho en voz alta al elemento del diagrama.
 *
 * Es la pieza que hace que el agente pueda trabajar por nombre, que es como habla la gente.
 * Tiene que tolerar lo que el reconocimiento de voz le hace a un nombre: cambia mayúsculas,
 * se come acentos, separa palabras pegadas y a veces oye una letra de más.
 *
 * La regla que no se negocia: ante la duda NO se elige. Se devuelven los candidatos para que
 * el agente pregunte. Acertar nueve de cada diez veces y renombrar la clase equivocada la
 * décima es peor que preguntar siempre.
 */

export type Resolucion<T> =
  | { tipo: 'uno'; valor: T }
  | { tipo: 'ninguno' }
  | { tipo: 'varios'; candidatos: string[] }

/** Sin acentos, sin mayúsculas y sin espacios: la forma en que dos nombres se comparan. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '')
}

/**
 * Distancia de edición, acotada.
 *
 * Solo se usa para decidir si dos nombres se parecen "lo bastante", así que no hace falta
 * calcularla entera: en cuanto pasa del límite, deja de importar cuánto más.
 */
function distancia(a: string, b: string, limite: number): number {
  if (Math.abs(a.length - b.length) > limite) return limite + 1

  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i)

  for (let i = 1; i <= a.length; i += 1) {
    const actual = [i]
    let mejor = i

    for (let j = 1; j <= b.length; j += 1) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1
      const valor = Math.min(actual[j - 1]! + 1, anterior[j]! + 1, anterior[j - 1]! + coste)

      actual.push(valor)
      if (valor < mejor) mejor = valor
    }

    // Toda la fila ya supera el límite: no hay forma de que el total baje de ahí.
    if (mejor > limite) return limite + 1
    anterior = actual
  }

  return anterior[b.length]!
}

/** Cuánto error se tolera según lo largo que sea el nombre. */
const tolerancia = (largo: number): number => (largo <= 4 ? 0 : largo <= 8 ? 1 : 2)

/**
 * Busca por nombre entre unos candidatos.
 *
 * Va por rondas, de lo más seguro a lo más flojo, y en cuanto una ronda encuentra algo no
 * pasa a la siguiente: una coincidencia exacta nunca compite con una aproximada.
 */
export function resolverPorNombre<T>(
  buscado: string,
  candidatos: readonly T[],
  nombreDe: (elemento: T) => string,
): Resolucion<T> {
  const objetivo = normalizar(buscado)

  if (objetivo === '') return { tipo: 'ninguno' }

  const conNombre = candidatos.map((elemento) => ({
    elemento,
    nombre: nombreDe(elemento),
    clave: normalizar(nombreDe(elemento)),
  }))

  const rondas = [
    conNombre.filter((c) => c.clave === objetivo),
    conNombre.filter((c) => c.clave.startsWith(objetivo) || objetivo.startsWith(c.clave)),
    conNombre.filter((c) => c.clave.includes(objetivo) || objetivo.includes(c.clave)),
    conNombre.filter((c) => distancia(c.clave, objetivo, tolerancia(objetivo.length)) <= tolerancia(objetivo.length)),
  ]

  for (const ronda of rondas) {
    if (ronda.length === 1) return { tipo: 'uno', valor: ronda[0]!.elemento }
    if (ronda.length > 1) return { tipo: 'varios', candidatos: ronda.map((c) => c.nombre) }
  }

  return { tipo: 'ninguno' }
}

export const resolverNodo = (doc: UmlDocument, nombre: string): Resolucion<UmlNode> =>
  resolverPorNombre(nombre, Object.values(doc.nodes), (nodo) => nodo.name)

/**
 * La relación entre dos clases.
 *
 * Dos clases pueden estar unidas por varias relaciones a la vez —"Start" y "Goal" entre
 * Aeropuerto y Vuelo—, así que el tipo sirve para desempatar. Si aun así quedan varias, se
 * devuelven todas descritas para que el agente pregunte cuál.
 */
export function resolverRelacion(
  doc: UmlDocument,
  origen: UmlNode,
  destino: UmlNode,
  tipo?: string,
): Resolucion<(typeof doc.edges)[string]> {
  // Sin dirección: el usuario dice "la relación entre A y B" sin pensar en cuál es cuál.
  const entreLasDos = Object.values(doc.edges).filter(
    (arista) =>
      (arista.source === origen.id && arista.target === destino.id) ||
      (arista.source === destino.id && arista.target === origen.id),
  )

  const filtradas =
    tipo === undefined ? entreLasDos : entreLasDos.filter((arista) => arista.kind === tipo)
  const finales = filtradas.length > 0 ? filtradas : entreLasDos

  if (finales.length === 0) return { tipo: 'ninguno' }
  if (finales.length === 1) return { tipo: 'uno', valor: finales[0]! }

  return {
    tipo: 'varios',
    candidatos: finales.map((arista) => {
      const nombre = arista.name === null || arista.name === '' ? '' : ` "${arista.name}"`
      return `${arista.kind}${nombre} de ${doc.nodes[arista.source]?.name} a ${doc.nodes[arista.target]?.name}`
    }),
  }
}
