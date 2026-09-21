import type { UmlDocument, UmlEdge, UmlNode } from '@/uml/model/types'

/**
 * El diagrama, contado en texto para el agente.
 *
 * No se le manda el JSON: las posiciones, los tamaños, los waypoints y los ids de cada
 * parámetro son ruido que paga tokens en cada turno y no le sirven para decidir nada. Se le
 * manda lo que necesita para hablar del modelo y para elegir sobre qué actuar.
 *
 * Los nombres van tal cual —es como el usuario se refiere a las cosas— y los ids NO
 * aparecen: el agente trabaja por nombre y quien traduce es `resolverNombre`. Meterle ids
 * solo conseguiría que a veces los dijera en voz alta.
 */

const SALTO = '\n'

const ETIQUETA: Record<string, string> = {
  association: 'asociación',
  'directed-association': 'asociación dirigida',
  aggregation: 'agregación',
  composition: 'composición',
  generalization: 'generalización',
  realization: 'realización',
  'association-class': 'clase de asociación',
}

/** "1..*" o "" si no se dijo. */
const mult = (valor: string | null): string => (valor === null || valor === '' ? '' : ` ${valor}`)

function miembrosDe(nodo: UmlNode): string {
  const atributos = (nodo.compartments.attributes ?? [])
    .filter((miembro) => miembro.kind === 'property')
    .map((miembro) => {
      if (miembro.kind !== 'property') return ''

      const tipo = miembro.type === null || miembro.type === '' ? '' : `: ${miembro.type}`
      const clave = miembro.isId ? ' {clave}' : ''

      return `${miembro.visibility}${miembro.name}${tipo}${mult(miembro.multiplicity)}${clave}`
    })

  const operaciones = (nodo.compartments.operations ?? [])
    .filter((miembro) => miembro.kind === 'operation')
    .map((miembro) => {
      if (miembro.kind !== 'operation') return ''

      const parametros = miembro.parameters
        .filter((parametro) => parametro.direction !== 'return')
        .map((parametro) => parametro.name)
        .join(', ')
      const retorno =
        miembro.returnType === null || miembro.returnType === '' ? '' : `: ${miembro.returnType}`

      return `${miembro.visibility}${miembro.name}(${parametros})${retorno}`
    })

  const partes: string[] = []
  if (atributos.length > 0) partes.push(`    atributos: ${atributos.join(', ')}`)
  if (operaciones.length > 0) partes.push(`    operaciones: ${operaciones.join(', ')}`)

  return partes.join('\n')
}

function relacionEnTexto(doc: UmlDocument, arista: UmlEdge): string {
  const nombre = (id: string) => doc.nodes[id]?.name ?? '?'
  const etiqueta = ETIQUETA[arista.kind] ?? arista.kind

  const rol = (valor: string | null) => (valor === null || valor === '' ? '' : ` rol ${valor}`)

  const clase = Object.values(doc.nodes).find((nodo) => nodo.associationId === arista.id)
  const conClase = clase === undefined ? '' : `, con clase de asociación ${clase.name}`
  const suNombre = arista.name === null || arista.name === '' ? '' : ` "${arista.name}"`

  return (
    `${etiqueta}${suNombre}: ${nombre(arista.source)}` +
    `[${mult(arista.ends.source.multiplicity).trim() || 'sin multiplicidad'}` +
    `${rol(arista.ends.source.role)}]` +
    ` → ${nombre(arista.target)}` +
    `[${mult(arista.ends.target.multiplicity).trim() || 'sin multiplicidad'}` +
    `${rol(arista.ends.target.role)}]${conClase}`
  )
}

/**
 * Dónde está dibujada cada clase, y qué se está pisando con qué.
 *
 * Sin esto el agente no puede hablar de la FORMA del diagrama: le preguntas por que se
 * solapan unas lineas y responde que no puede saberlo, porque literalmente no puede. Las
 * coordenadas van redondeadas a la decena —al pixel no le sirven y pagan tokens— y los
 * solapamientos ya vienen detectados, que es la conclusion que si no tendria que sacar el
 * a ojo leyendo numeros.
 */
function disposicionDe(nodos: UmlNode[], doc: UmlDocument): string {
  const cajas = nodos.map((nodo) => ({
    id: nodo.id,
    nombre: nodo.name,
    x: Math.round(nodo.position.x / 10) * 10,
    y: Math.round(nodo.position.y / 10) * 10,
    ancho: Math.round(nodo.size.width),
    alto: Math.round(nodo.size.height ?? 110),
  }))

  const lineas = cajas.map((c) => `  ${c.nombre}: x=${c.x} y=${c.y} (${c.ancho}x${c.alto})`)

  const encimadas: string[] = []

  for (let i = 0; i < cajas.length; i += 1) {
    for (let j = i + 1; j < cajas.length; j += 1) {
      const a = cajas[i]!
      const b = cajas[j]!

      if (a.x < b.x + b.ancho && a.x + a.ancho > b.x && a.y < b.y + b.alto && a.y + a.alto > b.y) {
        encimadas.push(`${a.nombre} y ${b.nombre}`)
      }
    }
  }

  /**
   * Una linea que cruza por encima de una clase que no es la suya. Es el otro solapamiento
   * del que se queja el usuario, y de una lista de coordenadas no se deduce a simple vista.
   */
  const cruces = new Set<string>()

  for (const arista of Object.values(doc.edges)) {
    const a = cajas.find((c) => c.id === arista.source)
    const b = cajas.find((c) => c.id === arista.target)
    if (a === undefined || b === undefined || a === b) continue

    const px = a.x + a.ancho / 2
    const py = a.y + a.alto / 2
    const qx = b.x + b.ancho / 2
    const qy = b.y + b.alto / 2

    for (const otra of cajas) {
      if (otra === a || otra === b) continue

      const cruza =
        Math.min(px, qx) < otra.x + otra.ancho &&
        Math.max(px, qx) > otra.x &&
        Math.min(py, qy) < otra.y + otra.alto &&
        Math.max(py, qy) > otra.y

      if (cruza) cruces.add(`la linea ${a.nombre}-${b.nombre} pasa sobre ${otra.nombre}`)
    }
  }

  const problemas = [
    encimadas.length === 0 ? null : `  Cajas encimadas: ${encimadas.join(', ')}.`,
    cruces.size === 0 ? null : `  ${[...cruces].slice(0, 6).join('; ')}.`,
  ].filter((linea): linea is string => linea !== null)

  return [
    ...lineas,
    ...(problemas.length === 0
      ? ['  Sin cajas encimadas ni lineas cruzando clases.']
      : ['  PROBLEMAS DE DISPOSICION:', ...problemas]),
  ].join(SALTO)
}

/**
 * El resumen completo, tal como viaja al agente.
 *
 * Se regenera después de cada cambio, venga del agente o del ratón: si el usuario arrastra
 * una clase nueva a mitad de la llamada, el agente tiene que enterarse.
 */
export function resumirDiagrama(doc: UmlDocument): string {
  const nodos = Object.values(doc.nodes).filter((nodo) => nodo.diagramId === doc.diagrams[0]?.id)
  const aristas = Object.values(doc.edges)

  if (nodos.length === 0) {
    return `Diagrama "${doc.meta.name}": está vacío, no tiene ninguna clase todavía.`
  }

  const clases = nodos.map((nodo) => {
    const tipo =
      nodo.kind === 'interface'
        ? ' (interfaz)'
        : nodo.kind === 'association-class'
          ? ' (clase de asociación)'
          : ''
    const abstracta = nodo.isAbstract ? ' (abstracta)' : ''
    const miembros = miembrosDe(nodo)

    return `  ${nodo.name}${tipo}${abstracta}${miembros === '' ? '' : `\n${miembros}`}`
  })

  const relaciones =
    aristas.length === 0
      ? '  (ninguna)'
      : aristas.map((arista) => `  ${relacionEnTexto(doc, arista)}`).join('\n')

  return [
    `Diagrama "${doc.meta.name}" — ${nodos.length} clases, ${aristas.length} relaciones.`,
    '',
    'CLASES',
    clases.join('\n'),
    '',
    'RELACIONES',
    relaciones,
    '',
    'DISPOSICION',
    disposicionDe(nodos, doc),
  ].join('\n')
}

/**
 * Lo que sabe el agente de UNA clase, para cuando pregunta por ella.
 *
 * Aquí sí entran sus relaciones, que en el resumen general están listadas aparte: si el
 * usuario pregunta "¿qué relaciones tiene SOCIO?", esto es la respuesta.
 */
export function detallarNodo(doc: UmlDocument, nodo: UmlNode): string {
  const suyas = Object.values(doc.edges).filter(
    (arista) => arista.source === nodo.id || arista.target === nodo.id,
  )

  const miembros = miembrosDe(nodo)

  return [
    `${nodo.name}${nodo.isAbstract ? ' (abstracta)' : ''}`,
    miembros === '' ? '    sin atributos ni operaciones' : miembros,
    suyas.length === 0
      ? '    sin relaciones'
      : `    relaciones:\n${suyas.map((arista) => `      ${relacionEnTexto(doc, arista)}`).join('\n')}`,
  ].join('\n')
}
