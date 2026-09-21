import type { Position, UmlDocument, UmlNode } from '@/uml/model/types'

/**
 * Dónde poner una clase que nace por voz.
 *
 * Por voz nadie dice coordenadas: dice "a la derecha de Ejemplar" o no dice nada. Así que
 * hay que elegir un sitio, y el criterio es que se vea: ni encima de otra caja ni en la otra
 * punta del lienzo.
 *
 * Las posiciones son la esquina superior izquierda, en píxeles, con la Y hacia abajo — lo
 * mismo que usa el lienzo.
 */

export type Direccion = 'derecha' | 'izquierda' | 'arriba' | 'abajo' | 'cerca'

/** Hueco que se deja entre dos cajas vecinas. */
const SEPARACION = 80

/** Tamaño con el que se cuenta antes de saber el alto real, que lo decide el contenido. */
const ANCHO = 220
const ALTO = 120

/** El paso de la rejilla del lienzo: las cajas quedan alineadas como si se arrastraran. */
const REJILLA = 8

const ajustar = (valor: number): number => Math.round(valor / REJILLA) * REJILLA

type Caja = { x: number; y: number; ancho: number; alto: number }

const cajaDe = (nodo: UmlNode): Caja => ({
  x: nodo.position.x,
  y: nodo.position.y,
  ancho: nodo.size.width,
  alto: nodo.size.height ?? ALTO,
})

const chocan = (a: Caja, b: Caja): boolean =>
  a.x < b.x + b.ancho + SEPARACION / 2 &&
  a.x + a.ancho + SEPARACION / 2 > b.x &&
  a.y < b.y + b.alto + SEPARACION / 2 &&
  a.y + a.alto + SEPARACION / 2 > b.y

/** Las cajas que ya ocupan sitio en el diagrama activo. */
function ocupadas(doc: UmlDocument, excepto?: string): Caja[] {
  const diagramaId = doc.diagrams[0]?.id

  return Object.values(doc.nodes)
    .filter((nodo) => nodo.diagramId === diagramaId && nodo.id !== excepto)
    .map(cajaDe)
}

const DESPLAZAMIENTOS: Record<Direccion, { dx: number; dy: number }> = {
  derecha: { dx: 1, dy: 0 },
  izquierda: { dx: -1, dy: 0 },
  abajo: { dx: 0, dy: 1 },
  arriba: { dx: 0, dy: -1 },
  cerca: { dx: 1, dy: 0 },
}

/**
 * Un sitio libre junto a una caja de referencia.
 *
 * Se empieza justo al lado, en la dirección pedida, y si está ocupado se va apartando en esa
 * misma dirección. No se cambia de dirección: si el usuario dijo "a la derecha", acabar
 * poniéndola debajo sería contradecirle.
 */
function juntoA(referencia: Caja, direccion: Direccion, libres: Caja[]): Position {
  const { dx, dy } = DESPLAZAMIENTOS[direccion]

  for (let intento = 0; intento < 12; intento += 1) {
    const salto = intento * (SEPARACION + (dx !== 0 ? ANCHO : ALTO))

    const candidata: Caja = {
      x: referencia.x + dx * (referencia.ancho + SEPARACION + salto),
      y: referencia.y + dy * (referencia.alto + SEPARACION + salto),
      ancho: ANCHO,
      alto: ALTO,
    }

    if (!libres.some((otra) => chocan(candidata, otra))) {
      return { x: ajustar(candidata.x), y: ajustar(candidata.y) }
    }
  }

  // Doce intentos en línea recta y todo ocupado: se deja al lado aunque se solape, que es
  // mejor que mandarla lejos donde el usuario no la encuentre.
  return {
    x: ajustar(referencia.x + dx * (referencia.ancho + SEPARACION)),
    y: ajustar(referencia.y + dy * (referencia.alto + SEPARACION)),
  }
}

/** Un hueco en el borde derecho de lo que ya hay, cuando no hay referencia. */
function alFinal(libres: Caja[]): Position {
  if (libres.length === 0) return { x: 120, y: 120 }

  const derecha = Math.max(...libres.map((caja) => caja.x + caja.ancho))
  const arriba = Math.min(...libres.map((caja) => caja.y))

  return { x: ajustar(derecha + SEPARACION), y: ajustar(arriba) }
}

/**
 * Dónde colocar un elemento nuevo.
 *
 * `cercaDe` es el nodo que el usuario nombró como referencia, si nombró alguno. Sin
 * referencia, la clase va al borde de lo que ya existe, que es donde se ve sin tapar nada.
 */
export function ubicarNuevo(
  doc: UmlDocument,
  cercaDe: UmlNode | null,
  direccion: Direccion = 'cerca',
): Position {
  const libres = ocupadas(doc)

  if (cercaDe === null) return alFinal(libres)

  return juntoA(cajaDe(cercaDe), direccion, libres)
}

/**
 * Dónde mover un elemento que ya existe.
 *
 * Se excluye el propio nodo de las cajas ocupadas: si no, se estorbaría a sí mismo y saldría
 * despedido cada vez que se le pide acercarse a algo.
 */
export function ubicarJuntoA(
  doc: UmlDocument,
  nodo: UmlNode,
  referencia: UmlNode,
  direccion: Direccion,
): Position {
  return juntoA(cajaDe(referencia), direccion, ocupadas(doc, nodo.id))
}
