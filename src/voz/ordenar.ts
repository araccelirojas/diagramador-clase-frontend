import type { Position, UmlDocument, UmlNode } from '@/uml/model/types'

/**
 * Recolocar el diagrama entero para que se lea.
 *
 * Esto es un algoritmo y no una decisión del agente a propósito. Un modelo de lenguaje no
 * puede calcular de cabeza una disposición sin solapamientos: lo intentaría moviendo cajas
 * de una en una, mirando texto, y el resultado sería peor que el desorden de partida. Lo que
 * sí sabe el agente es CUÁNDO conviene reordenar y contarlo; el dónde va cada caja se
 * calcula aquí.
 *
 * El criterio es el de un diagrama de clases dibujado a mano:
 *
 * 1. La herencia manda y se lee de arriba abajo: la superclase encima de sus subclases.
 * 2. Lo que está relacionado, cerca.
 * 3. Dentro de cada fila, el orden que menos cruces produce.
 * 4. Las clases de asociación, junto a la línea de la que cuelgan.
 */

/** Separación entre cajas vecinas de la misma fila. */
const HUECO_X = 90

/** Separación entre filas. Mayor que la horizontal: las líneas verticales necesitan sitio. */
const HUECO_Y = 130

const MARGEN = 80

/** Alto con el que se cuenta mientras el contenido no diga otra cosa. */
const ALTO_NOMINAL = 110

type Caja = { id: string; ancho: number; alto: number }

const medir = (nodo: UmlNode): Caja => ({
  id: nodo.id,
  ancho: nodo.size.width,
  alto: nodo.size.height ?? ALTO_NOMINAL,
})

/**
 * En qué fila va cada clase.
 *
 * La herencia fija el orden relativo —una subclase SIEMPRE por debajo de su superclase— y el
 * resto de relaciones solo acercan. Se recorre en anchura desde las raíces de la jerarquía
 * para que las ramas de una misma familia caigan juntas.
 */
function repartirEnFilas(
  nodos: UmlNode[],
  vecinos: Map<string, Set<string>>,
  superclaseDe: Map<string, string[]>,
): Map<string, number> {
  const fila = new Map<string, number>()

  // Primero, por profundidad de herencia: es la única jerarquía que el lector espera ver.
  const profundidad = (id: string, visitados = new Set<string>()): number => {
    if (visitados.has(id)) return 0
    visitados.add(id)

    const padres = superclaseDe.get(id) ?? []
    if (padres.length === 0) return 0

    return 1 + Math.max(...padres.map((padre) => profundidad(padre, visitados)))
  }

  for (const nodo of nodos) fila.set(nodo.id, profundidad(nodo.id))

  /**
   * Las clases que no participan en ninguna herencia se arrastran por debajo de sus vecinos.
   * Sin esto, un diagrama sin generalizaciones cae entero en una fila larguísima.
   *
   * "No participar" es no aparecer en NINGÚN extremo de una generalización. Mirar solo si
   * tienen superclase metía aquí a las superclases —que no tienen padre pero sí hijos— y las
   * empujaba por debajo de sus propias subclases, que es la herencia al revés.
   */
  const enJerarquia = new Set<string>()

  for (const [subclase, padres] of superclaseDe) {
    enJerarquia.add(subclase)
    for (const padre of padres) enJerarquia.add(padre)
  }

  const colocados = new Set(enJerarquia)

  for (const nodo of nodos) {
    if (colocados.has(nodo.id)) continue

    const cercanos = [...(vecinos.get(nodo.id) ?? [])]
      .filter((otro) => colocados.has(otro))
      .map((otro) => fila.get(otro) ?? 0)

    if (cercanos.length > 0) {
      fila.set(nodo.id, Math.max(...cercanos) + 1)
      colocados.add(nodo.id)
    }
  }

  return fila
}

/**
 * El orden dentro de cada fila, por baricentro.
 *
 * Cada caja se corre hacia la media de las posiciones de sus vecinos en la fila de arriba.
 * Es la heurística clásica para reducir cruces, y dos pasadas bastan: no busca el óptimo,
 * busca que no se vea mal.
 */
function ordenarFilas(
  filas: Map<number, string[]>,
  vecinos: Map<string, Set<string>>,
): Map<number, string[]> {
  const numeros = [...filas.keys()].sort((a, b) => a - b)

  for (let pasada = 0; pasada < 2; pasada += 1) {
    for (const numero of numeros) {
      const arriba = filas.get(numero - 1)
      if (arriba === undefined) continue

      const posicionArriba = new Map(arriba.map((id, indice) => [id, indice]))
      const actual = filas.get(numero)!

      const conPeso = actual.map((id, indice) => {
        const referencias = [...(vecinos.get(id) ?? [])]
          .map((otro) => posicionArriba.get(otro))
          .filter((valor): valor is number => valor !== undefined)

        return {
          id,
          // Sin vecinos arriba se queda donde está, en vez de irse al principio.
          peso:
            referencias.length === 0
              ? indice
              : referencias.reduce((suma, valor) => suma + valor, 0) / referencias.length,
        }
      })

      conPeso.sort((a, b) => a.peso - b.peso)
      filas.set(numero, conPeso.map((entrada) => entrada.id))
    }
  }

  return filas
}

const seSolapan = (
  a: { x: number; y: number; ancho: number; alto: number },
  b: { x: number; y: number; ancho: number; alto: number },
): boolean =>
  a.x < b.x + b.ancho + 24 &&
  a.x + a.ancho + 24 > b.x &&
  a.y < b.y + b.alto + 24 &&
  a.y + a.alto + 24 > b.y

/**
 * Calcula dónde va cada clase. No toca el documento: devuelve las posiciones y ya.
 *
 * Que sea una función pura es lo que permite probarla —comprobar que nada se solapa y que
 * ninguna subclase queda por encima de su superclase— sin montar un lienzo.
 */
export function calcularDisposicion(doc: UmlDocument): Map<string, Position> {
  const diagramaId = doc.diagrams[0]?.id
  const todos = Object.values(doc.nodes).filter((nodo) => nodo.diagramId === diagramaId)

  // Las clases de asociación no entran en las filas: cuelgan de una línea, no del flujo.
  const nodos = todos.filter((nodo) => nodo.associationId === null)
  const colgantes = todos.filter((nodo) => nodo.associationId !== null)

  if (nodos.length === 0) return new Map()

  const vecinos = new Map<string, Set<string>>()
  const superclaseDe = new Map<string, string[]>()

  const unir = (a: string, b: string) => {
    if (!vecinos.has(a)) vecinos.set(a, new Set())
    if (!vecinos.has(b)) vecinos.set(b, new Set())
    vecinos.get(a)!.add(b)
    vecinos.get(b)!.add(a)
  }

  for (const arista of Object.values(doc.edges)) {
    if (arista.source === arista.target) continue

    unir(arista.source, arista.target)

    if (arista.kind === 'generalization' || arista.kind === 'realization') {
      const padres = superclaseDe.get(arista.source) ?? []
      padres.push(arista.target)
      superclaseDe.set(arista.source, padres)
    }
  }

  const fila = repartirEnFilas(nodos, vecinos, superclaseDe)

  const filas = new Map<number, string[]>()
  for (const nodo of nodos) {
    const numero = fila.get(nodo.id) ?? 0
    filas.set(numero, [...(filas.get(numero) ?? []), nodo.id])
  }

  ordenarFilas(filas, vecinos)

  const medidas = new Map(todos.map((nodo) => [nodo.id, medir(nodo)]))
  const posiciones = new Map<string, Position>()

  // El ancho de la fila más ancha manda: las demás se centran respecto de ella.
  const anchoDeFila = (ids: string[]) =>
    ids.reduce((suma, id) => suma + (medidas.get(id)?.ancho ?? 200), 0) +
    HUECO_X * Math.max(ids.length - 1, 0)

  const numeros = [...filas.keys()].sort((a, b) => a - b)
  const anchoMaximo = Math.max(...numeros.map((numero) => anchoDeFila(filas.get(numero)!)))

  let y = MARGEN

  for (const numero of numeros) {
    const ids = filas.get(numero)!
    let x = MARGEN + (anchoMaximo - anchoDeFila(ids)) / 2

    for (const id of ids) {
      const caja = medidas.get(id)!
      posiciones.set(id, { x: Math.round(x), y: Math.round(y) })
      x += caja.ancho + HUECO_X
    }

    const altoDeFila = Math.max(...ids.map((id) => medidas.get(id)?.alto ?? ALTO_NOMINAL))
    y += altoDeFila + HUECO_Y
  }

  /**
   * Las clases de asociación, junto al medio de su línea y apartadas hacia un lado, que es
   * donde las dibuja cualquiera. Si el sitio está ocupado, se van bajando.
   */
  for (const colgante of colgantes) {
    const arista = doc.edges[colgante.associationId ?? '']
    const caja = medidas.get(colgante.id)!

    const extremos = [
      arista === undefined ? undefined : posiciones.get(arista.source),
      arista === undefined ? undefined : posiciones.get(arista.target),
    ].filter((valor): valor is Position => valor !== undefined)

    const centro =
      extremos.length === 2
        ? {
            x: (extremos[0]!.x + extremos[1]!.x) / 2,
            y: (extremos[0]!.y + extremos[1]!.y) / 2,
          }
        : { x: MARGEN, y }

    let candidata = {
      x: Math.round(centro.x + 160),
      y: Math.round(centro.y + 40),
      ancho: caja.ancho,
      alto: caja.alto,
    }

    const ocupadas = [...posiciones].map(([id, posicion]) => ({
      x: posicion.x,
      y: posicion.y,
      ancho: medidas.get(id)?.ancho ?? 200,
      alto: medidas.get(id)?.alto ?? ALTO_NOMINAL,
    }))

    for (let intento = 0; intento < 10; intento += 1) {
      if (!ocupadas.some((otra) => seSolapan(candidata, otra))) break
      candidata = { ...candidata, y: candidata.y + caja.alto + 40 }
    }

    posiciones.set(colgante.id, { x: candidata.x, y: candidata.y })
  }

  return posiciones
}
