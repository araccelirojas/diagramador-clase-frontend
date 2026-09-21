/**
 * XMI 2.1 -> documento.
 *
 * Tolerante por decisión: un .xmi de Enterprise Architect trae mucho más de lo que este
 * editor sabe dibujar —paquetes anidados, casos de uso, estados, notas— y rechazar el
 * fichero entero por una nota suelta lo volvería inservible. Se importa lo que se entiende
 * y se devuelve la lista de lo que quedó fuera, igual que el importador de bocetos.
 *
 * Lo que no se intenta adivinar se omite: un diagrama incompleto pero fiel es mejor que uno
 * completo e inventado.
 */

import {
  CLASIFICADOR_POR_TIPO_XMI,
  VISIBILIDAD_DESDE_XMI,
  multiplicidadDesdeLimites,
} from '@/io/xmi/nomenclatura'
import { attr, attrXmi, descendientes, esVerdadero, hijos, primerHijo } from '@/io/xmi/dom'
import { documentFromEa11 } from '@/io/xmi/ea11Leer'
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

const PREFIJO = 'EAID_'

const ANCHO_POR_DEFECTO = 220
const ALTO_NOMINAL = 90
const SEPARACION = 60

/**
 * La equivalencia entre el `xmi:id` del fichero y el id nuestro.
 *
 * Nuestro exportador escribe ids con la forma que pide EA —`EAID_` más un GUID— y ese GUID
 * es un hash, que no se puede deshacer. Por eso el fichero lleva la tabla, y aquí se lee
 * antes que nada: sin ella, reimportar nuestro propio diagrama daría uno equivalente pero
 * con todos los ids cambiados, y se perdería el vínculo con lo guardado en la nube.
 *
 * Es estado de módulo, como la caché de `selectors.ts`: `documentFromXmi` es la única
 * entrada, es síncrona, y lo primero que hace es vaciarla. Un .xmi ajeno no la trae y
 * entonces valen los ids tal como vengan.
 */
let equivalencias = new Map<string, string>()

const idNuestro = (id: string): string => {
  const propio = equivalencias.get(id)
  if (propio !== undefined) return propio

  // Un fichero de EA no trae tabla: su id vale tal cual, sin el prefijo si lo lleva.
  return id.startsWith(PREFIJO) ? id.slice(PREFIJO.length) : id
}

/**
 * Las factorías hacen `id ?? nuevoId()`, así que una cadena vacía se colaría tal cual y
 * produciría dos miembros con el mismo id. Un .xmi ajeno puede no traer `xmi:id` en todo.
 */
const idOpcional = (id: string): string | undefined => (id === '' ? undefined : id)

// --- lectura tolerante del DOM ---


const visibilidadDe = (texto: string | null): Visibility =>
  (texto !== null && VISIBILIDAD_DESDE_XMI[texto]) || '-'

/** El texto de un tipo. Puede venir como `EAJava_String` o como referencia a otro elemento. */
function tipoDe(elemento: Element, nombrePorId: Map<string, string>): string | null {
  const referencia = primerHijo(elemento, 'type')

  if (referencia !== null) {
    const idref = attrXmi(referencia, 'idref')
    if (idref === null) return null

    if (idref.startsWith('EAJava_')) return idref.slice('EAJava_'.length)

    // Referencia a una clase del propio modelo: vale su nombre.
    return nombrePorId.get(idref) ?? null
  }

  // Algunas versiones lo escriben como atributo suelto.
  return attr(elemento, 'type')
}

function multiplicidadDe(elemento: Element, porDefectoEsNada = false): string | null {
  const inferior = primerHijo(elemento, 'lowerValue')
  const superior = primerHijo(elemento, 'upperValue')

  if (inferior === null && superior === null) {
    // EA también la escribe suelta en su extensión, como "0..*".
    return attr(elemento, 'multiplicity')
  }

  /**
   * En un ATRIBUTO, `1..1` es el valor por defecto que EA escribe siempre, haya puesto algo
   * el usuario o no, y devolverlo llenaría el lienzo de multiplicidades que nadie escribió.
   * En un extremo de asociación no: ahí EA omite los límites cuando no hay multiplicidad,
   * así que un `1..1` presente sí lo escribió alguien.
   */
  if (
    porDefectoEsNada &&
    attr(inferior ?? elemento, 'value') === '1' &&
    attr(superior ?? elemento, 'value') === '1'
  ) {
    return null
  }

  return multiplicidadDesdeLimites(
    inferior === null ? null : attr(inferior, 'value'),
    superior === null ? null : attr(superior, 'value'),
  )
}

// --- geometría ---

/** `Left=100;Top=50;Right=300;Bottom=150;` */
function leerGeometria(texto: string | null): { x: number; y: number; w: number; h: number } | null {
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

  const derecha = partes.get('Right') ?? izquierda + ANCHO_POR_DEFECTO
  const abajo = partes.get('Bottom') ?? arriba + ALTO_NOMINAL

  return {
    x: izquierda,
    y: arriba,
    w: Math.max(derecha - izquierda, 80),
    h: Math.max(abajo - arriba, 40),
  }
}

// --- conversión ---

function miembrosDe(
  elemento: Element,
  nombrePorId: Map<string, string>,
  claves: Set<string>,
): { attributes: Member[]; operations: Member[] } {
  const attributes: Member[] = hijos(elemento, 'ownedAttribute')
    // Un ownedAttribute con `association` no es un atributo: es un extremo de asociación
    // que la clase posee por ser navegable. La relación ya lo recoge por su lado.
    .filter((hijo) => attr(hijo, 'association') === null)
    .map((hijo) =>
      createProperty({
        id: idOpcional(idNuestro(attrXmi(hijo, 'id') ?? '')),
        name: attr(hijo, 'name') ?? 'sinNombre',
        type: tipoDe(hijo, nombrePorId),
        visibility: visibilidadDe(attr(hijo, 'visibility')),
        multiplicity: multiplicidadDe(hijo, true),
        defaultValue: attr(primerHijo(hijo, 'defaultValue') ?? hijo, 'value'),
        isStatic: esVerdadero(attr(hijo, 'isStatic')),
        isDerived: esVerdadero(attr(hijo, 'isDerived')),
        isReadOnly: esVerdadero(attr(hijo, 'isReadOnly')),
        // Es de donde sale la clave primaria al generar el backend. EA no tiene un campo
        // propio, así que además del atributo estándar se mira el censo de la extensión.
        isId:
          esVerdadero(attr(hijo, 'isID')) ||
          claves.has(idNuestro(attrXmi(hijo, 'id') ?? '')),
        isOrdered: esVerdadero(attr(hijo, 'isOrdered')),
        isUnique: attr(hijo, 'isUnique') !== 'false',
      }),
    )

  const operations: Member[] = hijos(elemento, 'ownedOperation').map((hijo) => {
    const parametros = hijos(hijo, 'ownedParameter')
    const retorno = parametros.find((p) => attr(p, 'direction') === 'return')

    return createOperation({
      id: idOpcional(idNuestro(attrXmi(hijo, 'id') ?? '')),
      name: attr(hijo, 'name') ?? 'sinNombre',
      visibility: visibilidadDe(attr(hijo, 'visibility')),
      returnType: retorno === undefined ? null : tipoDe(retorno, nombrePorId),
      isStatic: esVerdadero(attr(hijo, 'isStatic')),
      isAbstract: esVerdadero(attr(hijo, 'isAbstract')),
      isQuery: esVerdadero(attr(hijo, 'isQuery')),
      parameters: parametros
        .filter((p) => p !== retorno)
        .map((p) =>
          createParameter({
            id: idOpcional(idNuestro(attrXmi(p, 'id') ?? '')),
            name: attr(p, 'name') ?? 'arg',
            type: tipoDe(p, nombrePorId),
            direction: (attr(p, 'direction') ?? 'in') as ParameterDirection,
          }),
        ),
    })
  })

  return { attributes, operations }
}

/** Los dos extremos de una asociación, en el orden en que los declara `memberEnd`. */
/**
 * Cuál de los dos extremos es el origen.
 *
 * NO se puede deducir del orden de `<memberEnd>`: Enterprise Architect los escribe con el
 * destino primero, así que fiarse de ese orden invierte la relación. Se usan, por este
 * orden, tres señales cada vez menos fiables:
 *
 * 1. El conector de la extensión de EA, que dice sin ambigüedad qué clase es el origen.
 * 2. La convención de EA de nombrar sus extremos `EAID_src…` y `EAID_dst…`.
 * 3. El orden de aparición, que es lo único que queda en un fichero de otra herramienta.
 */
function extremosDe(
  elemento: Element,
  idsDeNodo: Set<string>,
  orientacion: { source: string; target: string } | undefined,
): { source: Element; target: Element } | null {
  const propios = hijos(elemento, 'ownedEnd')
  if (propios.length !== 2) return null

  const tipoDeExtremo = (extremo: Element): string | null => {
    const referencia = primerHijo(extremo, 'type')
    const idref = referencia === null ? null : attrXmi(referencia, 'idref')
    return idref === null ? null : idNuestro(idref)
  }

  let [uno, otro] = propios as [Element, Element]

  const idUno = tipoDeExtremo(uno)
  const idOtro = tipoDeExtremo(otro)

  if (idUno === null || idOtro === null) return null
  if (!idsDeNodo.has(idUno) || !idsDeNodo.has(idOtro)) return null

  // El conector manda, salvo en una auto-asociación, donde los dos extremos son la misma
  // clase y el idref no distingue cuál es cuál.
  if (orientacion !== undefined && idUno !== idOtro) {
    if (idOtro === orientacion.source) [uno, otro] = [otro, uno]
    return { source: uno, target: otro }
  }

  const esOrigen = (extremo: Element): boolean =>
    (attrXmi(extremo, 'id') ?? '').includes('_src')

  if (esOrigen(otro) && !esOrigen(uno)) [uno, otro] = [otro, uno]

  return { source: uno, target: otro }
}

const extremoDesde = (elemento: Element, navegable: boolean | null) =>
  createAssociationEnd({
    role: attr(elemento, 'name'),
    multiplicity: multiplicidadDe(elemento),
    // Sin `visibility` escrita el extremo queda "sin especificar", que no es lo mismo que
    // público: nuestro modelo distingue los dos casos y UML también.
    visibility: (() => {
      const texto = attr(elemento, 'visibility')
      return texto === null ? null : (VISIBILIDAD_DESDE_XMI[texto] ?? null)
    })(),
    navigable: navegable,
    isOrdered: esVerdadero(attr(elemento, 'isOrdered')),
    isUnique: attr(elemento, 'isUnique') !== 'false',
  })

/**
 * Qué relación nuestra es una asociación, según la agregación de sus extremos.
 *
 * UML pone `composite` / `shared` en el extremo tipado por la PARTE, así que el extremo
 * marcado indica de qué lado está el todo: si lo lleva el destino, el origen es el todo y
 * ese es justo nuestro convenio. Si lo lleva el origen, hay que dar la vuelta a la relación.
 */
function claseDeAsociacion(
  agregacionOrigen: string | null,
  agregacionDestino: string | null,
): { kind: string; invertir: boolean } {
  const marca = (valor: string | null): string | null =>
    valor === 'composite' || valor === 'shared' ? valor : null

  const enDestino = marca(agregacionDestino)
  if (enDestino !== null) {
    return { kind: enDestino === 'composite' ? 'composition' : 'aggregation', invertir: false }
  }

  const enOrigen = marca(agregacionOrigen)
  if (enOrigen !== null) {
    return { kind: enOrigen === 'composite' ? 'composition' : 'aggregation', invertir: true }
  }

  return { kind: 'association', invertir: false }
}

export function documentFromXmi(texto: string, nombre: string): XmiResult {
  const avisos: string[] = []

  let xml: Document
  try {
    xml = new DOMParser().parseFromString(texto, 'application/xml')
  } catch {
    return { ok: false, error: 'No se pudo leer el archivo como XML.' }
  }

  // DOMParser no lanza: informa del fallo con un <parsererror> dentro del resultado.
  if (xml.getElementsByTagName('parsererror').length > 0) {
    return { ok: false, error: 'El archivo no es XML válido.' }
  }

  const raizXmi = xml.documentElement
  if (raizXmi === null) return { ok: false, error: 'El archivo está vacío.' }

  /**
   * Qué dialecto es.
   *
   * Enterprise Architect exporta por defecto XMI 1.1 con metamodelo UML 1.3, que no se
   * parece en nada a XMI 2.1: `xmi.id` con punto, `<UML:Class>` en vez de
   * `<packagedElement>`, y el diagrama como elemento de primera clase en vez de escondido en
   * una extensión. Se reconoce por la versión declarada en la raíz.
   */
  const version = attrXmi(raizXmi, 'version')

  if (version !== null && version.startsWith('1.')) {
    return documentFromEa11(xml, nombre)
  }

  // Antes que nada: sin la tabla, todo lo que se lea debajo usaría ids equivocados.
  equivalencias = new Map<string, string>()

  for (const entrada of descendientes(raizXmi, 'id')) {
    const enFichero = attr(entrada, 'xmi')
    const propio = attr(entrada, 'propio')

    if (enFichero !== null && propio !== null) equivalencias.set(enFichero, propio)
  }

  const modelo = descendientes(xml, 'Model')[0] ?? raizXmi
  const doc = createDocument({ name: nombre })
  const diagramaId = doc.diagrams[0]!.id

  // --- 1. clasificadores ---

  const empaquetados = descendientes(modelo, 'packagedElement')
  const nombrePorId = new Map<string, string>()

  for (const elemento of empaquetados) {
    const id = attrXmi(elemento, 'id')
    const nombreElemento = attr(elemento, 'name')
    if (id !== null && nombreElemento !== null) nombrePorId.set(id, nombreElemento)
  }

  /**
   * Lo que EA guarda SOLO en su censo, indexado por el id del elemento.
   *
   * `isAbstract` no está en el `packagedElement` —EA lo escribe en `<properties>` de la
   * extensión— y el `{id}` de UML no tiene hueco propio en su formato, así que nuestro
   * exportador lo mete en la bolsa `styleex` del atributo, que ya existe.
   */
  const abstractas = new Set<string>()
  const clavesDe = new Map<string, Set<string>>()
  /** De la clase de asociación a la relación de la que cuelga. */
  const conIdDe = new Map<string, string>()

  for (const entrada of descendientes(raizXmi, 'element')) {
    const referencia = attrXmi(entrada, 'idref')
    if (referencia === null) continue

    const props = primerHijo(entrada, 'properties')
    if (props !== null && attr(props, 'isAbstract') === 'true') abstractas.add(idNuestro(referencia))

    const extra = primerHijo(entrada, 'extendedProperties')
    const conId = extra === null ? null : attr(extra, 'conID')
    if (conId !== null) conIdDe.set(idNuestro(referencia), idNuestro(conId))

    const atributos = primerHijo(entrada, 'attributes')
    if (atributos === null) continue

    const claves = new Set<string>()

    for (const atributo of hijos(atributos, 'attribute')) {
      const estilo = primerHijo(atributo, 'styleex')
      const valor = estilo === null ? null : attr(estilo, 'value')
      const id = attrXmi(atributo, 'idref')

      if (id !== null && valor !== null && valor.includes('IsID=1')) claves.add(idNuestro(id))
    }

    if (claves.size > 0) clavesDe.set(idNuestro(referencia), claves)
  }

  // Geometrías de la extensión de EA, por id de elemento.
  const geometrias = new Map<string, { x: number; y: number; w: number; h: number }>()
  /** Los que dijeron que su alto lo decide el contenido. */
  const altoAutomatico = new Set<string>()
  /** Estereotipos: lo que se dibuja como «entity». */
  const estereotipos = new Map<string, string[]>()

  for (const elemento of descendientes(raizXmi, 'element')) {
    const sujeto = attr(elemento, 'subject')
    const caja = leerGeometria(attr(elemento, 'geometry'))

    if (sujeto !== null && caja !== null) {
      const id = idNuestro(sujeto)
      geometrias.set(id, caja)
      if (attr(elemento, 'altoAutomatico') === 'true') altoAutomatico.add(id)
    }

    // La otra mitad de <elements>: la que lleva el estereotipo y no la geometría.
    const referencia = attrXmi(elemento, 'idref')
    const props = primerHijo(elemento, 'properties')
    const estereotipo = props === null ? null : attr(props, 'stereotype')

    if (referencia !== null && estereotipo !== null) {
      estereotipos.set(
        idNuestro(referencia),
        estereotipo.split(',').map((texto) => texto.trim()).filter((texto) => texto !== ''),
      )
    }
  }

  const nodos: UmlNode[] = []
  const idsDeNodo = new Set<string>()
  /** Las clases de asociación se enganchan a su arista al final. */
  const clasesDeAsociacion = new Map<string, UmlNode>()
  const noSoportados = new Map<string, number>()

  let sinPosicion = 0

  for (const elemento of empaquetados) {
    const tipo = attrXmi(elemento, 'type')
    if (tipo === null) continue

    // Los paquetes no se importan como tal: su contenido ya se recorre en plano.
    if (tipo === 'uml:Package') continue

    // Las relaciones se tratan aparte, en el paso 2.
    if (tipo === 'uml:Association' || tipo === 'uml:Realization' || tipo === 'uml:Dependency') {
      continue
    }

    const kind = CLASIFICADOR_POR_TIPO_XMI[tipo]

    if (kind === undefined) {
      noSoportados.set(tipo, (noSoportados.get(tipo) ?? 0) + 1)
      continue
    }

    const id = idNuestro(attrXmi(elemento, 'id') ?? '')
    if (id === '') continue

    const esClaseDeAsociacion = tipo === 'uml:AssociationClass'
    // Al exportar guardamos aparte el id del nodo, porque el elemento lleva el de la arista.
    /**
     * En una clase de asociación el `packagedElement` lleva el id de la CLASE, y la relación
     * tiene el suyo propio, que el censo enlaza con `conID`. Es como lo escribe EA, y es lo
     * que permite volver a separarlos en un nodo y una arista al importar.
     */
    const idNodo = id
    const idRelacion = esClaseDeAsociacion ? (conIdDe.get(id) ?? `${id}_rel`) : id

    const caja = geometrias.get(idNodo) ?? geometrias.get(id) ?? null
    if (caja === null) sinPosicion += 1

    const spec = getClassifier(kind)
    const nodo = createNode({
      id: idNodo,
      kind,
      diagramId: diagramaId,
      name: attr(elemento, 'name') ?? 'SinNombre',
      visibility: visibilidadDe(attr(elemento, 'visibility')),
      isAbstract: esVerdadero(attr(elemento, 'isAbstract')) || abstractas.has(idNodo),
      position: { x: caja?.x ?? 0, y: caja?.y ?? 0 },
      size: {
        width: caja?.w ?? spec.defaultSize.width,
        height: altoAutomatico.has(idNodo) ? null : (caja?.h ?? null),
      },
      compartmentIds: compartmentIdsOf(spec),
      keywords: estereotipos.get(idNodo) ?? (kind === 'interface' ? (spec.defaultKeywords ?? []) : []),
    })

    const miembros = miembrosDe(elemento, nombrePorId, clavesDe.get(idNodo) ?? new Set())
    nodo.compartments.attributes = miembros.attributes
    nodo.compartments.operations = miembros.operations

    nodos.push(nodo)
    idsDeNodo.add(nodo.id)

    if (esClaseDeAsociacion) clasesDeAsociacion.set(idRelacion, nodo)
  }

  if (nodos.length === 0) {
    return { ok: false, error: 'No se encontró ninguna clase ni interfaz en el archivo.' }
  }

  // Sin geometría no hay dónde ponerlas: se reparten en rejilla para que se vean todas.
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
      `${sinPosicion} ${sinPosicion === 1 ? 'clase venía' : 'clases venían'} sin posición: ` +
        'se colocaron en rejilla.',
    )
  }

  // --- 2. relaciones ---

  /**
   * Navegabilidad según la extensión de EA, por relación.
   *
   * Hace falta además de `navigableOwnedEnd` porque esa lista solo dice quién SÍ es
   * navegable: un extremo ausente puede ser "no navegable" o "no se dijo", y en UML —y en
   * nuestro modelo— no es lo mismo. EA lo escribe explícito, así que cuando está, manda.
   */
  const navegabilidadEA = new Map<string, { source: boolean | null; target: boolean | null }>()

  /** Qué clase es el origen de cada relación, según EA. Ver `extremosDe`. */
  const orientacionEA = new Map<string, { source: string; target: string }>()

  for (const conector of descendientes(raizXmi, 'connector')) {
    const referencia = attrXmi(conector, 'idref')
    if (referencia === null) continue

    const nodoDe = (lado: 'source' | 'target'): string | null => {
      const extremo = primerHijo(conector, lado)
      const idref = extremo === null ? null : attrXmi(extremo, 'idref')
      return idref === null ? null : idNuestro(idref)
    }

    const origen = nodoDe('source')
    const destino = nodoDe('target')

    if (origen !== null && destino !== null) {
      orientacionEA.set(idNuestro(referencia), { source: origen, target: destino })
    }

    const leer = (lado: 'source' | 'target'): boolean | null => {
      const extremo = primerHijo(conector, lado)
      if (extremo === null) return null

      /**
       * `Navigable=` del `<style>` primero: es el único de los tres sitios que distingue
       * "no se dijo" de "no navegable". `<modifiers isNavigable>` es un booleano y da
       * `false` en los dos casos, lo que convertía asociaciones normales en dirigidas.
       */
      const estilo = primerHijo(extremo, 'style')
      const texto = estilo === null ? null : attr(estilo, 'value')
      const marca = texto === null ? null : /Navigable=([A-Za-z-]+)/.exec(texto)?.[1]

      if (marca === 'Unspecified') return null
      if (marca === 'Navigable') return true
      if (marca === 'Non-Navigable') return false

      const tipo = primerHijo(extremo, 'type')
      const valor = tipo === null ? null : attr(tipo, 'navigability')

      if (valor !== null) return valor === 'Navigable'

      const modificadores = primerHijo(extremo, 'modifiers')
      const explicito = modificadores === null ? null : attr(modificadores, 'isNavigable')

      return explicito === null ? null : explicito === 'true'
    }

    navegabilidadEA.set(idNuestro(referencia), { source: leer('source'), target: leer('target') })
  }

  const aristas: UmlEdge[] = []

  const nuevaArista = (
    id: string | undefined,
    kind: string,
    source: string,
    target: string,
    extras: Partial<UmlEdge> = {},
  ): void => {
    if (!idsDeNodo.has(source) || !idsDeNodo.has(target)) return
    aristas.push({ ...createEdge({ id, kind, diagramId: diagramaId, source, target }), ...extras })
  }

  // Generalizaciones: van anidadas dentro de la subclase, que es nuestro origen.
  for (const elemento of descendientes(modelo, 'generalization')) {
    const padre = elemento.parentElement
    if (padre === null) continue

    const subclase = idNuestro(attrXmi(padre, 'id') ?? '')
    const superclase = idNuestro(attr(elemento, 'general') ?? attrXmi(elemento, 'idref') ?? '')

    nuevaArista(
      idOpcional(idNuestro(attrXmi(elemento, 'id') ?? '')),
      'generalization',
      subclase,
      superclase,
    )
  }

  for (const elemento of empaquetados) {
    const tipo = attrXmi(elemento, 'type')
    const id = idNuestro(attrXmi(elemento, 'id') ?? '')

    if (tipo === 'uml:Realization' || tipo === 'uml:Abstraction') {
      const cliente = idNuestro(attr(elemento, 'client') ?? '')
      const proveedor = idNuestro(attr(elemento, 'supplier') ?? '')
      nuevaArista(idOpcional(id), 'realization', cliente, proveedor)
      continue
    }

    if (tipo !== 'uml:Association' && tipo !== 'uml:AssociationClass') continue

    const extremos = extremosDe(elemento, idsDeNodo, orientacionEA.get(id))

    if (extremos === null) {
      avisos.push(`Una relación ("${attr(elemento, 'name') ?? id}") no tenía dos extremos válidos: se omitió.`)
      continue
    }

    const idDe = (extremo: Element): string =>
      idNuestro(attrXmi(primerHijo(extremo, 'type')!, 'idref') ?? '')

    const clasificacion = claseDeAsociacion(
      attr(extremos.source, 'aggregation'),
      attr(extremos.target, 'aggregation'),
    )

    const invertir = clasificacion.invertir
    const origen = invertir ? extremos.target : extremos.source
    const destino = invertir ? extremos.source : extremos.target

    /**
     * UML 2 no marca la navegabilidad con un atributo: dice qué extremos son navegables
     * listándolos en `navigableOwnedEnd`. Si solo lo es el destino, eso ES una asociación
     * dirigida, que es como la dibuja este editor.
     */
    const navegables = new Set(
      hijos(elemento, 'navigableOwnedEnd')
        .map((n) => attrXmi(n, 'idref'))
        .filter((ref): ref is string => ref !== null),
    )

    const navegabilidadDe = (extremo: Element): boolean | null => {
      if (navegables.size === 0) return null
      return navegables.has(attrXmi(extremo, 'id') ?? '')
    }

    /**
     * La extensión de EA manda ENTERA si está, nulos incluidos: ahí "no se dijo" es un dato
     * tan bueno como los otros dos. Con `??` se caía al otro método justo en ese caso, y una
     * asociación normal acababa convertida en dirigida.
     *
     * `invertir` ya cambió cuál extremo es el origen, así que los lados se cruzan con él.
     */
    const deEA = navegabilidadEA.get(id)

    const navOrigen = deEA ? (invertir ? deEA.target : deEA.source) : navegabilidadDe(origen)
    const navDestino = deEA ? (invertir ? deEA.source : deEA.target) : navegabilidadDe(destino)

    // Dirigida solo cuando el origen es EXPLÍCITAMENTE no navegable. Deducirlo de un
    // extremo simplemente ausente convertía asociaciones normales en dirigidas.
    const dirigida = navOrigen === false && navDestino === true

    const kind =
      tipo === 'uml:AssociationClass'
        ? 'association-class'
        : clasificacion.kind === 'association' && dirigida
          ? 'directed-association'
          : clasificacion.kind

    /**
     * En una clase de asociación el id del elemento es el de la CLASE: la relación tiene el
     * suyo, que el censo enlaza con `conID`. Reutilizar aquí el del elemento haría que el
     * nodo y la arista compartieran id, y el documento dejaría de ser válido.
     */
    const idArista = tipo === 'uml:AssociationClass' ? (conIdDe.get(id) ?? `${id}_rel`) : id

    nuevaArista(idOpcional(idArista), kind, idDe(origen), idDe(destino), {
      // En una clase de asociación el nombre es el de la clase, que ya lo lleva el nodo.
      // Copiarlo también a la arista lo duplicaría en el dibujo.
      name: tipo === 'uml:AssociationClass' ? null : attr(elemento, 'name'),
      ends: {
        source: extremoDesde(origen, navOrigen),
        target: extremoDesde(destino, navDestino),
      },
    })
  }

  // --- 3. las clases de asociación vuelven a colgar de su relación ---

  for (const [idArista, nodo] of clasesDeAsociacion) {
    const arista = aristas.find((a) => a.id === idArista)

    if (arista === undefined) {
      // Sin su relación no puede existir como tal: se queda como clase normal (§5.4.6).
      nodo.kind = 'class'
      avisos.push(`"${nodo.name}" es una clase de asociación sin relación: se importó como clase.`)
      continue
    }

    nodo.associationId = arista.id
  }

  for (const [tipo, cuantos] of noSoportados) {
    avisos.push(`${cuantos} × ${tipo}: este editor no lo representa, se omitió.`)
  }

  // --- 4. armar y validar ---

  const armado: UmlDocument = {
    ...doc,
    nodes: Object.fromEntries(nodos.map((n) => [n.id, n])),
    edges: Object.fromEntries(aristas.map((a) => [a.id, a])),
  }

  const validado = deserializeValue(armado)

  if (!validado.ok) {
    return { ok: false, error: validado.error }
  }

  return { ok: true, doc: validado.doc, avisos }
}
