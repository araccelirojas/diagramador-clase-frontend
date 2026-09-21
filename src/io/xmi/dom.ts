/**
 * Lectura tolerante de XML, compartida por los dos dialectos de XMI.
 *
 * Todo va por `localName` y nunca por el nombre completo con prefijo: el mismo elemento se
 * llama `UML:Class` en un fichero y `packagedElement` en otro, los prefijos los elige quien
 * escribe, y el URI del espacio de nombres cambia entre versiones de Enterprise Architect.
 */

export const attr = (elemento: Element, nombre: string): string | null => {
  const valor = elemento.getAttribute(nombre)
  return valor === null || valor === '' ? null : valor
}

/**
 * Un atributo que puede venir con prefijo y con separadores distintos.
 *
 * XMI 2.1 escribe `xmi:id` y XMI 1.1 escribe `xmi.id`. Se prueban las dos formas, y como
 * último recurso cualquier atributo cuyo nombre local coincida, sea cual sea su prefijo.
 */
export function attrXmi(elemento: Element, nombre: string): string | null {
  const conDosPuntos = attr(elemento, `xmi:${nombre}`)
  if (conDosPuntos !== null) return conDosPuntos

  const conPunto = attr(elemento, `xmi.${nombre}`)
  if (conPunto !== null) return conPunto

  for (const atributo of Array.from(elemento.attributes)) {
    if (atributo.localName === nombre && atributo.value !== '') return atributo.value
  }

  return null
}

/** Hijos directos con ese nombre local, sin importar el prefijo. */
export const hijos = (elemento: Element, nombre: string): Element[] =>
  Array.from(elemento.children).filter((hijo) => hijo.localName === nombre)

export const primerHijo = (elemento: Element, nombre: string): Element | null =>
  hijos(elemento, nombre)[0] ?? null

/** Descendientes a cualquier profundidad con ese nombre local. */
export const descendientes = (raiz: Element | Document, nombre: string): Element[] =>
  Array.from(raiz.getElementsByTagName('*')).filter((el) => el.localName === nombre)

export const esVerdadero = (valor: string | null): boolean => valor === 'true'

/**
 * Los `<UML:TaggedValue tag="…" value="…"/>` de un elemento, como mapa.
 *
 * En XMI 1.1 casi todo lo que no es estructura viaja así: el estereotipo, el tipo de
 * elemento de EA, los límites de una multiplicidad, la clase de asociación. Solo se miran
 * los del PROPIO elemento —`<UML:ModelElement.taggedValue>` directo— porque buscándolos en
 * profundidad se mezclarían con los de sus atributos y operaciones.
 */
export function etiquetas(elemento: Element): Map<string, string> {
  const mapa = new Map<string, string>()
  const contenedor = primerHijo(elemento, 'ModelElement.taggedValue')

  if (contenedor === null) return mapa

  for (const etiqueta of hijos(contenedor, 'TaggedValue')) {
    const clave = attr(etiqueta, 'tag')
    if (clave !== null) mapa.set(clave, attr(etiqueta, 'value') ?? '')
  }

  return mapa
}

/**
 * `Left=100;Top=50;Right=300;Bottom=150;` — cómo EA guarda una caja, en los dos dialectos.
 *
 * Devuelve null para la geometría de una línea (`EDGE=2;…`), que no tiene caja.
 */
export function leerGeometria(
  texto: string | null,
  anchoPorDefecto: number,
  altoPorDefecto: number,
): { x: number; y: number; w: number; h: number } | null {
  if (texto === null) return null

  const partes = new Map<string, number>()

  for (const trozo of texto.split(';')) {
    const [clave, valor] = trozo.split('=')
    if (clave === undefined || valor === undefined) continue

    const numero = Number(valor)
    if (Number.isFinite(numero)) partes.set(clave.trim(), numero)
  }

  const izquierda = partes.get('Left')
  const arriba = partes.get('Top')

  if (izquierda === undefined || arriba === undefined) return null

  const derecha = partes.get('Right') ?? izquierda + anchoPorDefecto
  const abajo = partes.get('Bottom') ?? arriba + altoPorDefecto

  return {
    x: izquierda,
    y: arriba,
    w: Math.max(derecha - izquierda, 80),
    h: Math.max(abajo - arriba, 40),
  }
}
