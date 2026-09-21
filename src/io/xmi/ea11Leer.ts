/**
 * XMI 1.1 con metamodelo UML 1.3 -> documento.
 *
 * Es el formato que exporta Enterprise Architect por defecto, y no se parece al XMI 2.1: el
 * identificador es `xmi.id` con punto, las clases son `<UML:Class>` colgando de
 * `<UML:Namespace.ownedElement>`, y casi todo lo que no es estructura viaja como
 * `<UML:TaggedValue>`.
 *
 * La diferencia que más cuesta ver es dónde está el diagrama: aquí `<UML:Diagram>` es un
 * elemento de primera clase dentro de `<XMI.content>`, no algo escondido en una extensión.
 *
 * Y la que más cuesta acertar es la dirección de una agregación. UML 1.3 pone el rombo en el
 * extremo del TODO; UML 2.x lo pone en el de la parte. Son convenios opuestos, así que leer
 * un fichero de EA con la regla de UML 2 produce composiciones invertidas: un modelo que
 * abre sin errores y borra las películas al borrar una copia.
 */

import {
  attr,
  attrXmi,
  descendientes,
  etiquetas,
  hijos,
  leerGeometria,
  primerHijo,
} from '@/io/xmi/dom'
import { VISIBILIDAD_DESDE_XMI } from '@/io/xmi/nomenclatura'
import { deserializeValue } from '@/io/deserialize'
import {
  createAssociationEnd,
  createDocument,
  createEdge,
  createNode,
  createOperation,
  createParameter,
  createProperty,
} from '@/uml/model/factories'
import { compartmentIdsOf, getClassifier } from '@/uml/registry'
import type {
  Member,
  ParameterDirection,
  UmlDocument,
  UmlEdge,
  UmlNode,
  Visibility,
} from '@/uml/model/types'

export type XmiResult =
  | { ok: true; doc: UmlDocument; avisos: string[] }
  | { ok: false; error: string }

const ANCHO_POR_DEFECTO = 220
const ALTO_NOMINAL = 90
const SEPARACION = 60

/** La clase técnica que EA mete en todo modelo y que no es del usuario. */
const RAIZ_EA = 'EARootClass'

/** `ea_ntype` de un elemento que es la clase de una asociación. */
const NTYPE_CLASE_ASOCIACION = '17'

const visibilidadDe = (texto: string | null): Visibility =>
  (texto !== null && VISIBILIDAD_DESDE_XMI[texto.toLowerCase()]) || '-'

/**
 * La multiplicidad, a partir de los límites que EA guarda como etiquetas.
 *
 * Un atributo sin multiplicidad explícita sale igualmente con `1..1`, que es el valor por
 * defecto de UML y no algo que el usuario haya escrito. Devolverlo llenaría el editor de
 * multiplicidades que nadie puso, así que ese caso concreto se trata como "sin decir".
 */
function multiplicidadDeEtiquetas(tags: Map<string, string>): string | null {
  const inferior = tags.get('lowerBound')
  const superior = tags.get('upperBound')

  if (inferior === undefined && superior === undefined) return null
  if (inferior === '1' && superior === '1') return null

  const bajo = inferior ?? '0'
  const alto = superior ?? '*'

  if (bajo === alto) return bajo
  return `${bajo}..${alto}`
}

/** `0..*` viene ya escrito en el atributo `multiplicity` de un extremo de asociación. */
const multiplicidadDeExtremo = (extremo: Element): string | null => {
  const texto = attr(extremo, 'multiplicity')
  return texto === null || texto === '1..1' ? texto : texto
}

function miembrosDe(
  clase: Element,
  tipoPorId: Map<string, string>,
): { attributes: Member[]; operations: Member[] } {
  const rasgos = primerHijo(clase, 'Classifier.feature')

  if (rasgos === null) return { attributes: [], operations: [] }

  const tipoDe = (miembro: Element): string | null => {
    const contenedor = primerHijo(miembro, 'StructuralFeature.type')
    const referencia = contenedor === null ? null : primerHijo(contenedor, 'Classifier')
    const idref = referencia === null ? null : attrXmi(referencia, 'idref')

    return idref === null ? null : (tipoPorId.get(idref) ?? null)
  }

  /**
   * EA ordena los atributos como le conviene y guarda el orden real en `position`. Sin
   * esto, los atributos aparecen alfabéticos y no como el usuario los escribió.
   */
  const porPosicion = (a: { pos: number }, b: { pos: number }) => a.pos - b.pos

  const attributes = hijos(rasgos, 'Attribute')
    .map((miembro) => {
      const tags = etiquetas(miembro)

      return {
        pos: Number(tags.get('position') ?? '0'),
        valor: createProperty({
          name: attr(miembro, 'name') ?? 'sinNombre',
          type: tipoDe(miembro),
          visibility: visibilidadDe(attr(miembro, 'visibility')),
          multiplicity: multiplicidadDeEtiquetas(tags),
          defaultValue: null,
          isStatic: tags.get('static') === '1',
          isDerived: tags.get('derived') === '1',
          // UML 1.3 llama `frozen` a lo que UML 2 marca como de solo lectura. `none` no es
          // "sin decir": es el valor por defecto de EA, que significa modificable.
          isReadOnly: attr(miembro, 'changeable') === 'frozen',
          /**
           * El `{id}` de UML 2.5 no existe en UML 1.3, así que nuestro exportador lo manda
           * como etiqueta. Un fichero de EA no la trae y el atributo sale sin marcar, que es
           * lo correcto: la clave primaria la elige el usuario antes de exportar, no se
           * adivina.
           */
          isId: tags.get('isID') === '1',
          isOrdered: tags.get('ordered') === '1',
          isUnique: tags.get('duplicates') !== '1',
        }),
      }
    })
    .sort(porPosicion)
    .map((entrada) => entrada.valor as Member)

  const operations = hijos(rasgos, 'Operation')
    .map((miembro) => {
      const tags = etiquetas(miembro)
      const contenedor = primerHijo(miembro, 'BehavioralFeature.parameter')
      const parametros = contenedor === null ? [] : hijos(contenedor, 'Parameter')
      const retorno = parametros.find((p) => attr(p, 'kind') === 'return')

      return {
        pos: Number(tags.get('pos') ?? tags.get('position') ?? '0'),
        valor: createOperation({
          name: attr(miembro, 'name') ?? 'sinNombre',
          visibility: visibilidadDe(attr(miembro, 'visibility')),
          returnType: retorno === undefined ? null : tipoDe(retorno),
          isStatic: tags.get('static') === '1',
          isAbstract: attr(miembro, 'isAbstract') === 'true',
          isQuery: attr(miembro, 'isQuery') === 'true',
          parameters: parametros
            .filter((p) => p !== retorno)
            .map((p) =>
              createParameter({
                name: attr(p, 'name') ?? 'arg',
                type: tipoDe(p),
                direction: (attr(p, 'kind') ?? 'in') as ParameterDirection,
              }),
            ),
        }),
      }
    })
    .sort(porPosicion)
    .map((entrada) => entrada.valor as Member)

  return { attributes, operations }
}

/**
 * De qué lado está el todo en una agregación.
 *
 * UML 1.3 marca `aggregation` en el extremo del TODO. Nuestro modelo pone el todo en el
 * origen, así que si la marca viene en el extremo de destino hay que dar la vuelta a la
 * relación entera, multiplicidades incluidas.
 */
function clasificarAsociacion(
  extremoOrigen: Element,
  extremoDestino: Element,
): { kind: string; invertir: boolean } {
  const marca = (extremo: Element): string | null => {
    const valor = attr(extremo, 'aggregation')
    return valor === 'composite' || valor === 'shared' ? valor : null
  }

  const enOrigen = marca(extremoOrigen)
  if (enOrigen !== null) {
    return { kind: enOrigen === 'composite' ? 'composition' : 'aggregation', invertir: false }
  }

  const enDestino = marca(extremoDestino)
  if (enDestino !== null) {
    return { kind: enDestino === 'composite' ? 'composition' : 'aggregation', invertir: true }
  }

  return { kind: 'association', invertir: false }
}

export function documentFromEa11(xml: Document, nombre: string): XmiResult {
  const avisos: string[] = []
  const raiz = xml.documentElement

  /**
   * La equivalencia entre el id del fichero y el nuestro.
   *
   * Nuestro exportador le da a EA ids con forma de GUID, derivados de los nuestros con un
   * hash que no se puede deshacer, y anota el original en una `<UML:TaggedValue>` del propio
   * elemento. Un .xmi que venga de EA no la trae, y entonces sus ids valen tal cual.
   */
  const equivalencias = new Map<string, string>()

  for (const elemento of Array.from(raiz.getElementsByTagName('*'))) {
    const enFichero = attrXmi(elemento, 'id')
    if (enFichero === null) continue

    const propio = etiquetas(elemento).get('diagramador_id')
    if (propio !== undefined && propio !== '') equivalencias.set(enFichero, propio)
  }

  const idNuestro = (id: string): string => equivalencias.get(id) ?? id

  const doc = createDocument({ name: nombre })
  const diagramaId = doc.diagrams[0]!.id

  // --- los tipos, que viven aparte y se referencian por id ---

  const tipoPorId = new Map<string, string>()

  for (const tipo of descendientes(raiz, 'DataType')) {
    const id = attrXmi(tipo, 'id')
    const nombreTipo = attr(tipo, 'name')

    // El DataType sin nombre (`eaxmiid0`) es el "sin tipo" de EA, no un tipo llamado "".
    if (id !== null && nombreTipo !== null) tipoPorId.set(id, nombreTipo)
  }

  for (const clase of descendientes(raiz, 'Class')) {
    const id = attrXmi(clase, 'id')
    const nombreClase = attr(clase, 'name')
    if (id !== null && nombreClase !== null) tipoPorId.set(id, nombreClase)
  }

  // --- geometrías, del diagrama ---

  const geometrias = new Map<string, { x: number; y: number; w: number; h: number }>()

  for (const elemento of descendientes(raiz, 'DiagramElement')) {
    const sujeto = attr(elemento, 'subject')
    // Las líneas también son DiagramElement, con geometría `EDGE=…` y sin caja.
    const caja = leerGeometria(attr(elemento, 'geometry'), ANCHO_POR_DEFECTO, ALTO_NOMINAL)

    if (sujeto === null || caja === null) continue

    geometrias.set(idNuestro(sujeto), caja)
  }

  const nombreDiagrama = descendientes(raiz, 'Diagram')[0]
  if (nombreDiagrama !== undefined) {
    const suNombre = attr(nombreDiagrama, 'name')
    if (suNombre !== null) doc.diagrams[0] = { ...doc.diagrams[0]!, name: suNombre }
  }

  // --- clases e interfaces ---

  const nodos: UmlNode[] = []
  const idsDeNodo = new Set<string>()
  /** Clase de asociación -> id de la asociación de la que cuelga. */
  const cuelgaDe = new Map<string, string>()
  const noSoportados = new Map<string, number>()

  let sinPosicion = 0

  const construir = (elemento: Element, kind: string): void => {
    const enFichero = attrXmi(elemento, 'id')
    if (enFichero === null) return

    const id = idNuestro(enFichero)

    const nombreElemento = attr(elemento, 'name')
    if (nombreElemento === RAIZ_EA) return

    const tags = etiquetas(elemento)
    const caja = geometrias.get(id) ?? null
    if (caja === null) sinPosicion += 1

    const esDeAsociacion = tags.get('ea_ntype') === NTYPE_CLASE_ASOCIACION
    const kindFinal = esDeAsociacion ? 'association-class' : kind
    const spec = getClassifier(kindFinal)

    const nodo = createNode({
      id,
      kind: kindFinal,
      diagramId: diagramaId,
      name: nombreElemento ?? 'SinNombre',
      visibility: visibilidadDe(attr(elemento, 'visibility')),
      isAbstract: attr(elemento, 'isAbstract') === 'true',
      position: { x: caja?.x ?? 0, y: caja?.y ?? 0 },
      size: {
        width: caja?.w ?? spec.defaultSize.width,
        height: tags.get('diagramador_alto') === 'auto' ? null : (caja?.h ?? null),
      },
      compartmentIds: compartmentIdsOf(spec),
      keywords: kindFinal === 'interface' ? (spec.defaultKeywords ?? []) : [],
    })

    const miembros = miembrosDe(elemento, tipoPorId)
    nodo.compartments.attributes = miembros.attributes
    nodo.compartments.operations = miembros.operations

    nodos.push(nodo)
    idsDeNodo.add(nodo.id)

    // `conID` apunta a la asociación de la que esta clase es la clase de asociación.
    const conID = tags.get('conID')
    if (esDeAsociacion && conID !== undefined && conID !== '') cuelgaDe.set(nodo.id, idNuestro(conID))
  }

  for (const elemento of descendientes(raiz, 'Class')) construir(elemento, 'class')
  for (const elemento of descendientes(raiz, 'Interface')) construir(elemento, 'interface')

  for (const nombreTipo of ['UseCase', 'Actor', 'Component', 'Node', 'State', 'Activity']) {
    const cuantos = descendientes(raiz, nombreTipo).length
    if (cuantos > 0) noSoportados.set(`UML:${nombreTipo}`, cuantos)
  }

  if (nodos.length === 0) {
    return { ok: false, error: 'No se encontró ninguna clase ni interfaz en el archivo.' }
  }

  if (sinPosicion > 0) {
    let columna = 0
    let fila = 0

    for (const nodo of nodos) {
      if (geometrias.has(nodo.id)) continue

      nodo.position = {
        x: columna * (ANCHO_POR_DEFECTO + SEPARACION),
        y: fila * (ALTO_NOMINAL * 2 + SEPARACION),
      }

      columna += 1
      if (columna === 4) {
        columna = 0
        fila += 1
      }
    }

    avisos.push(
      `${sinPosicion} ${sinPosicion === 1 ? 'clase venía' : 'clases venían'} sin posición en el ` +
        'diagrama: se colocaron en rejilla.',
    )
  }

  // --- relaciones ---

  const aristas: UmlEdge[] = []

  const nuevaArista = (
    id: string,
    kind: string,
    source: string,
    target: string,
    extras: Partial<UmlEdge> = {},
  ): void => {
    if (!idsDeNodo.has(source) || !idsDeNodo.has(target)) return

    aristas.push({
      ...createEdge({ id: id === '' ? undefined : id, kind, diagramId: diagramaId, source, target }),
      ...extras,
    })
  }

  for (const elemento of descendientes(raiz, 'Generalization')) {
    // `subtype` es la subclase y `supertype` la superclase, igual que nuestro origen/destino.
    nuevaArista(
      idNuestro(attrXmi(elemento, 'id') ?? ''),
      'generalization',
      idNuestro(attr(elemento, 'subtype') ?? ''),
      idNuestro(attr(elemento, 'supertype') ?? ''),
    )
  }

  for (const elemento of descendientes(raiz, 'Abstraction')) {
    nuevaArista(
      idNuestro(attrXmi(elemento, 'id') ?? ''),
      'realization',
      idNuestro(attr(elemento, 'client') ?? ''),
      idNuestro(attr(elemento, 'supplier') ?? ''),
    )
  }

  for (const elemento of descendientes(raiz, 'Association')) {
    const id = idNuestro(attrXmi(elemento, 'id') ?? '')
    const conexion = primerHijo(elemento, 'Association.connection')
    const extremos = conexion === null ? [] : hijos(conexion, 'AssociationEnd')

    if (extremos.length !== 2) {
      avisos.push(`Una asociación ("${attr(elemento, 'name') ?? id}") no tenía dos extremos.`)
      continue
    }

    // El orden lo fija EA con una etiqueta, no la posición en el XML.
    const ladoDe = (extremo: Element): string => etiquetas(extremo).get('ea_end') ?? ''
    const porLado = extremos.find((e) => ladoDe(e) === 'source')
    const otro = extremos.find((e) => ladoDe(e) === 'target')

    const uno = porLado ?? extremos[0]!
    const dos = otro ?? extremos[1]!

    const clasificacion = clasificarAsociacion(uno, dos)
    const origen = clasificacion.invertir ? dos : uno
    const destino = clasificacion.invertir ? uno : dos

    const tipoDeExtremo = (extremo: Element): string => idNuestro(attr(extremo, 'type') ?? '')

    const tags = etiquetas(elemento)
    const claseAsociacion = tags.get('associationclass')

    const navegable = (extremo: Element): boolean | null => {
      const valor = attr(extremo, 'isNavigable')
      return valor === null ? null : valor === 'true'
    }

    /**
     * Una asociación dirigida es la que solo se puede recorrer en un sentido. EA no tiene un
     * tipo aparte para eso: lo dice con la navegabilidad de cada extremo, y la punta de
     * flecha del dibujo sale de ahí.
     */
    const dirigida = navegable(origen) === false && navegable(destino) === true

    const kind =
      claseAsociacion !== undefined && claseAsociacion !== ''
        ? 'association-class'
        : clasificacion.kind === 'association' && dirigida
          ? 'directed-association'
          : clasificacion.kind

    nuevaArista(id, kind, tipoDeExtremo(origen), tipoDeExtremo(destino), {
      // En una clase de asociación el nombre lo lleva la clase, no la línea.
      name: kind === 'association-class' ? null : attr(elemento, 'name'),
      ends: {
        source: createAssociationEnd({
          role: attr(origen, 'name'),
          multiplicity: multiplicidadDeExtremo(origen),
          navigable: navegable(origen),
          isOrdered: attr(origen, 'isOrdered') === 'true',
        }),
        target: createAssociationEnd({
          role: attr(destino, 'name'),
          multiplicity: multiplicidadDeExtremo(destino),
          navigable: navegable(destino),
          isOrdered: attr(destino, 'isOrdered') === 'true',
        }),
      },
    })
  }

  // --- las clases de asociación vuelven a colgar de su relación ---

  for (const nodo of nodos) {
    if (nodo.kind !== 'association-class') continue

    const idAsociacion = cuelgaDe.get(nodo.id)
    const arista = idAsociacion === undefined ? undefined : aristas.find((a) => a.id === idAsociacion)

    if (arista === undefined) {
      // Sin su relación no puede existir como clase de asociación (§5.4.6).
      nodo.kind = 'class'
      avisos.push(`"${nodo.name}" es una clase de asociación sin relación: se importó como clase.`)
      continue
    }

    nodo.associationId = arista.id
    arista.kind = 'association-class'
  }

  for (const [tipo, cuantos] of noSoportados) {
    avisos.push(`${cuantos} × ${tipo}: este editor no lo representa, se omitió.`)
  }

  const armado: UmlDocument = {
    ...doc,
    nodes: Object.fromEntries(nodos.map((n) => [n.id, n])),
    edges: Object.fromEntries(aristas.map((a) => [a.id, a])),
  }

  const validado = deserializeValue(armado)
  if (!validado.ok) return { ok: false, error: validado.error }

  return { ok: true, doc: validado.doc, avisos }
}
