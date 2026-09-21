import { deserializeValue } from '@/io/deserialize'
import {
  createDocument,
  createEdge,
  createNode,
  createOperation,
  createParameter,
  createProperty,
  MAIN_DIAGRAM_ID,
} from '@/uml/model/factories'
import type { Member, UmlDocument, UmlNode, Visibility } from '@/uml/model/types'
import { compartmentIdsOf, getClassifier, hasRelation } from '@/uml/registry'

/**
 * Lo que el modelo de visión leyó de un boceto -> un documento UML de verdad.
 *
 * La conversión vive en el frontend, no en el backend que hace la llamada, porque el
 * contrato del documento vive acá (CLAUDE.md §5): ids, invariantes, `schemaVersion` y
 * migraciones. Construirlo allá sería una segunda verdad que se separa de esta al primer
 * cambio de esquema.
 *
 * Nada de lo que llega se da por bueno: el resultado pasa por el mismo zod que una
 * importación de archivo antes de volver.
 */

// --- lo que devuelve el backend, espejo de boceto/esquema.js ---

export type CajaBoceto = { x: number; y: number; ancho: number; alto: number }

export type AtributoBoceto = {
  nombre: string
  tipo: string | null
  visibilidad: string
  multiplicidad: string | null
  esClave: boolean
}

export type OperacionBoceto = {
  nombre: string
  tipoRetorno: string | null
  visibilidad: string
  parametros: { nombre: string; tipo: string | null }[]
}

export type ClaseBoceto = {
  nombre: string
  esInterfaz: boolean
  esAbstracta: boolean
  caja: CajaBoceto
  atributos: AtributoBoceto[]
  operaciones: OperacionBoceto[]
}

export type RelacionBoceto = {
  tipo: string
  origen: string
  destino: string
  nombre: string | null
  multiplicidadOrigen: string | null
  multiplicidadDestino: string | null
  rolOrigen: string | null
  rolDestino: string | null
  claseAsociacion: string | null
}

export type Boceto = { clases: ClaseBoceto[]; relaciones: RelacionBoceto[] }

export type SketchResult =
  | { ok: true; doc: UmlDocument; avisos: string[] }
  | { ok: false; error: string; details: string[] }

// --- medidas del lienzo ---

/** A cuánto equivale el ancho completo de la foto, en unidades del lienzo. */
const ESCALA_X = 1800
const ESCALA_Y = 1100

const ANCHO_MIN = 160
const ANCHO_MAX = 360
const ALTO_CABECERA = 44
const ALTO_FILA = 22
const SEPARACION = 24
const REJILLA = 8

const ajustar = (valor: number) => Math.round(valor / REJILLA) * REJILLA

const VISIBILIDADES = new Set<Visibility>(['+', '-', '#', '~'])

const visibilidadDe = (texto: string): Visibility =>
  VISIBILIDADES.has(texto as Visibility) ? (texto as Visibility) : '-'

/** Alto aproximado de una caja según su contenido, para poder separar solapes. */
function altoEstimado(clase: ClaseBoceto): number {
  const filas = clase.atributos.length + clase.operaciones.length
  return ALTO_CABECERA + Math.max(filas, 2) * ALTO_FILA
}

const seSolapan = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean =>
  a.x < b.x + b.w + SEPARACION &&
  a.x + a.w + SEPARACION > b.x &&
  a.y < b.y + b.h + SEPARACION &&
  a.y + a.h + SEPARACION > b.y

/**
 * Coordenadas normalizadas -> posiciones del lienzo, saneadas.
 *
 * Un modelo de visión da posiciones APROXIMADAS: es lo que peor hace. Se respetan —es lo
 * que hace que el resultado se parezca al boceto— pero se corrigen las dos formas en que
 * fallan: cajas encimadas y cajas fuera de rango. Si vienen del todo inservibles (todas en
 * el mismo punto, o fuera de 0..1), se cae a una rejilla, que es feo pero legible.
 */
export function ubicar(clases: ClaseBoceto[]): {
  posiciones: { x: number; y: number; ancho: number }[]
  avisos: string[]
} {
  const avisos: string[] = []

  const utiles = clases.filter(
    (clase) =>
      Number.isFinite(clase.caja.x) &&
      Number.isFinite(clase.caja.y) &&
      clase.caja.x >= -0.5 &&
      clase.caja.x <= 1.5 &&
      clase.caja.y >= -0.5 &&
      clase.caja.y <= 1.5,
  )

  const distintas = new Set(utiles.map((clase) => `${clase.caja.x.toFixed(3)},${clase.caja.y.toFixed(3)}`))

  // Todas en el mismo sitio, o casi ninguna con coordenadas creíbles: no hay nada que respetar.
  const inservibles = utiles.length < clases.length * 0.6 || distintas.size < Math.min(2, clases.length)

  if (inservibles && clases.length > 0) {
    avisos.push('El modelo no devolvió posiciones utilizables: se ordenaron en una rejilla.')

    const porFila = Math.max(1, Math.ceil(Math.sqrt(clases.length)))

    return {
      posiciones: clases.map((clase, indice) => ({
        x: ajustar((indice % porFila) * (ANCHO_MAX + SEPARACION * 3)),
        y: ajustar(Math.floor(indice / porFila) * (altoEstimado(clase) + SEPARACION * 4)),
        ancho: ANCHO_MAX,
      })),
      avisos,
    }
  }

  const cajas = clases.map((clase) => {
    const anchoBruto = (clase.caja.ancho || 0) * ESCALA_X
    const ancho = ajustar(Math.min(ANCHO_MAX, Math.max(ANCHO_MIN, anchoBruto || ANCHO_MIN * 1.4)))

    return {
      x: ajustar(Math.max(0, clase.caja.x) * ESCALA_X),
      y: ajustar(Math.max(0, clase.caja.y) * ESCALA_Y),
      w: ancho,
      h: altoEstimado(clase),
    }
  })

  // Separación de solapes: se recorre de arriba abajo y se empuja hacia abajo lo que choca
  // con algo ya colocado. Empujar siempre en el mismo sentido mantiene el orden de lectura
  // del boceto; moverlas en cualquier dirección lo destruiría.
  const orden = cajas.map((_, indice) => indice).sort((a, b) => cajas[a]!.y - cajas[b]!.y || cajas[a]!.x - cajas[b]!.x)
  const colocadas: typeof cajas = []
  let movidas = 0

  for (const indice of orden) {
    const caja = cajas[indice]!
    let intentos = 0

    while (colocadas.some((otra) => seSolapan(caja, otra)) && intentos < 200) {
      caja.y = ajustar(caja.y + ALTO_FILA)
      intentos += 1
    }

    if (intentos > 0) movidas += 1
    colocadas.push(caja)
  }

  if (movidas > 0) {
    avisos.push(`Se separaron ${movidas} ${movidas === 1 ? 'caja encimada' : 'cajas encimadas'}.`)
  }

  return {
    posiciones: cajas.map((caja) => ({ x: caja.x, y: caja.y, ancho: caja.w })),
    avisos,
  }
}

// --- construcción del documento ---

function miembrosDe(clase: ClaseBoceto): { attributes: Member[]; operations: Member[] } {
  const attributes: Member[] = clase.atributos.map((atributo) =>
    createProperty({
      name: atributo.nombre,
      type: atributo.tipo,
      visibility: visibilidadDe(atributo.visibilidad),
      multiplicity: atributo.multiplicidad,
      // El {id} de UML: el exportador lo usa como clave primaria.
      isId: atributo.esClave,
    }),
  )

  const operations: Member[] = clase.operaciones.map((operacion) =>
    createOperation({
      name: operacion.nombre,
      returnType: operacion.tipoRetorno,
      visibility: visibilidadDe(operacion.visibilidad),
      parameters: operacion.parametros.map((parametro) =>
        createParameter({ name: parametro.nombre, type: parametro.tipo }),
      ),
    }),
  )

  return { attributes, operations }
}

export function documentFromSketch(boceto: Boceto, nombre: string): SketchResult {
  const avisos: string[] = []
  const doc = createDocument({ name: nombre })

  const clases = Array.isArray(boceto.clases) ? boceto.clases : []
  const relaciones = Array.isArray(boceto.relaciones) ? boceto.relaciones : []

  // Qué clases cuelgan de una relación: tienen que nacer con kind 'association-class'.
  const clasesDeAsociacion = new Map<string, RelacionBoceto>()

  for (const relacion of relaciones) {
    if (relacion.tipo !== 'association-class' || !relacion.claseAsociacion) continue
    clasesDeAsociacion.set(relacion.claseAsociacion, relacion)
  }

  const { posiciones, avisos: avisosUbicacion } = ubicar(clases)
  avisos.push(...avisosUbicacion)

  const porNombre = new Map<string, UmlNode>()

  clases.forEach((clase, indice) => {
    const esAsociacion = clasesDeAsociacion.has(clase.nombre)
    const kind = esAsociacion ? 'association-class' : clase.esInterfaz ? 'interface' : 'class'
    const spec = getClassifier(kind)
    const posicion = posiciones[indice] ?? { x: 0, y: 0, ancho: ANCHO_MAX }

    const nodo = createNode({
      kind,
      name: clase.nombre.trim() === '' ? 'SinNombre' : clase.nombre.trim(),
      position: { x: posicion.x, y: posicion.y },
      size: { width: posicion.ancho, height: null },
      compartmentIds: compartmentIdsOf(spec),
      // Una interfaz ya es abstracta por definición; marcarla además sería ruido.
      isAbstract: clase.esInterfaz ? false : clase.esAbstracta,
      keywords: clase.esInterfaz ? (spec.defaultKeywords ?? []) : [],
    })

    const miembros = miembrosDe(clase)
    nodo.compartments.attributes = miembros.attributes
    nodo.compartments.operations = miembros.operations

    doc.nodes[nodo.id] = nodo

    // Con dos clases del mismo nombre gana la primera: el resto no se podría referenciar.
    if (porNombre.has(nodo.name)) {
      avisos.push(`Hay más de una clase llamada "${nodo.name}": las relaciones usan la primera.`)
    } else {
      porNombre.set(nodo.name, nodo)
    }
  })

  for (const relacion of relaciones) {
    const origen = porNombre.get(relacion.origen.trim())
    const destino = porNombre.get(relacion.destino.trim())

    if (!origen || !destino) {
      avisos.push(
        `Se descartó una relación entre "${relacion.origen}" y "${relacion.destino}": ` +
          'alguno de los dos no es una clase del boceto.',
      )
      continue
    }

    let kind = relacion.tipo

    if (!hasRelation(kind)) {
      avisos.push(`El tipo de relación "${kind}" no existe: se usó una asociación simple.`)
      kind = 'association'
    }

    // Una clase de asociación sin su clase es solo una asociación.
    if (kind === 'association-class' && !relacion.claseAsociacion) {
      kind = 'association'
    }

    const arista = createEdge({
      kind,
      source: origen.id,
      target: destino.id,
      name: relacion.nombre,
      ends: {
        source: { multiplicity: relacion.multiplicidadOrigen, role: relacion.rolOrigen },
        target: { multiplicity: relacion.multiplicidadDestino, role: relacion.rolDestino },
      },
    })

    doc.edges[arista.id] = arista

    // La caja colgante apunta a ESTA arista: es lo que la convierte en clase de asociación.
    if (kind === 'association-class' && relacion.claseAsociacion) {
      const colgante = porNombre.get(relacion.claseAsociacion.trim())

      if (colgante) colgante.associationId = arista.id
      else avisos.push(`No se encontró la clase de asociación "${relacion.claseAsociacion}".`)
    }
  }

  // Una clase de asociación que quedó sin arista rompería el invariante §5.4.6.
  for (const nodo of Object.values(doc.nodes)) {
    if (nodo.kind !== 'association-class' || nodo.associationId !== null) continue

    avisos.push(`"${nodo.name}" quedó sin su relación: se convirtió en una clase normal.`)
    nodo.kind = 'class'
  }

  doc.diagrams[0] = { id: MAIN_DIAGRAM_ID, name: 'Modelo de dominio', viewport: { x: 0, y: 0, zoom: 1 } }

  // El mismo zod que una importación de archivo: lo que viene de un modelo no se cree.
  const validado = deserializeValue(doc)

  if (!validado.ok) return validado

  return { ok: true, doc: validado.doc, avisos }
}
