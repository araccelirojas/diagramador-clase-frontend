/**
 * Documento -> XMI 2.1 para Enterprise Architect.
 *
 * Escrito replicando un fichero REAL exportado por EA (`fixtures/ea-xmi21.xmi`), no
 * deduciéndolo de la especificación. La diferencia importa: XMI describe el modelo UML, pero
 * dónde está dibujada cada caja vive entero en
 * `<xmi:Extension extender="Enterprise Architect">`, que es cosa suya y no está en ningún
 * estándar. El criterio de que esto es correcto es que el árbol de elementos y atributos que
 * produce coincide con el de su fichero.
 *
 * Tres cosas que se pagan caras si se hacen "a nuestra manera":
 *
 * 1. Nada de elementos ni atributos inventados. Su importador descarta lo que contiene algo
 *    que no reconoce, y descartar un `<element>` del diagrama es perder una posición sin que
 *    nada falle ni avise.
 * 2. El censo `<elements>` lleva una entrada por CADA elemento, con sus hijos completos.
 * 3. Los conectores también son elementos del diagrama, con su propia geometría.
 */

import {
  NS,
  TIPO_XMI_POR_CLASIFICADOR,
  VISIBILIDAD_XMI,
  XMI_VERSION,
  limitesDeMultiplicidad,
} from '@/io/xmi/nomenclatura'
import type { Operation, Property, UmlDocument, UmlEdge, UmlNode } from '@/uml/model/types'

/**
 * Los identificadores, con la forma que usa EA: `EAID_` y un GUID con guiones bajos.
 *
 * Se derivan de los nuestros con un hash, así que exportar dos veces el mismo diagrama
 * produce el mismo fichero en vez de uno distinto cada vez.
 */
const PREFIJO = 'EAID_'

/** FNV-1a de 32 bits. Cuatro pasadas con semillas distintas dan los 128 del GUID. */
function hash32(texto: string, semilla: number): number {
  let valor = semilla >>> 0

  for (let i = 0; i < texto.length; i += 1) {
    valor ^= texto.charCodeAt(i)
    valor = Math.imul(valor, 0x01000193) >>> 0
  }

  return valor >>> 0
}

const enHex = (numero: number): string => numero.toString(16).padStart(8, '0').toUpperCase()

export function guidDe(id: string): string {
  const hex =
    enHex(hash32(id, 0x811c9dc5)) +
    enHex(hash32(id, 0x01000193)) +
    enHex(hash32(id, 0xdeadbeef)) +
    enHex(hash32(id, 0x9e3779b9))

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('_')
}

export const idXmi = (id: string): string => `${PREFIJO}${guidDe(id)}`

/** EA identifica cada figura del diagrama con un id corto propio. */
const duid = (id: string): string => guidDe(id).slice(0, 8)

/** Alto de una caja cuyo alto lo decide el contenido. */
const ALTO_NOMINAL = 90

/**
 * Margen al normalizar las coordenadas.
 *
 * El lienzo del editor admite coordenadas negativas —se puede arrastrar una clase por encima
 * y a la izquierda del origen— y EA no. Se traslada todo para que la caja más arriba y más a
 * la izquierda quede en este margen, conservando las posiciones RELATIVAS, que es lo que
 * define el dibujo.
 */
const MARGEN = 20

const ID_PAQUETE = `EAPK_${guidDe('paquete-raiz')}`

/** Lo que EA pone en `<properties ea_type="…">` de cada conector. */
const EA_TYPE: Record<string, string> = {
  association: 'Association',
  'directed-association': 'Association',
  aggregation: 'Aggregation',
  composition: 'Aggregation',
  generalization: 'Generalization',
  realization: 'Realisation',
  'association-class': 'Association',
}

/** El rombo va en el extremo tipado por la PARTE, que en nuestro modelo es el destino. */
const AGREGACION_EN_DESTINO: Record<string, string> = {
  composition: 'composite',
  aggregation: 'shared',
}

const APARIENCIA =
  'BackColor=-1;BorderColor=-1;BorderWidth=-1;FontColor=-1;VSwimLanes=1;HSwimLanes=1;BorderStyle=0;'

const ESTILO_CAJA =
  'NSL=0;BCol=-1;BFol=-1;LCol=-1;LWth=-1;fontsz=0;bold=0;black=0;italic=0;ul=0;charset=0;pitch=0;'

type Ctx = {
  doc: XMLDocument
  /** EA numera sus elementos y los referencia por ese número dentro de la extensión. */
  localId: Map<string, number>
  /** El nodo que es la clase de cada arista, si lo hay. */
  claseDeArista: Map<string, UmlNode>
  fecha: string
}

function crear(ctx: Ctx, nombre: string): Element {
  const dosPuntos = nombre.indexOf(':')

  if (dosPuntos === -1) return ctx.doc.createElementNS(null, nombre)

  const prefijo = nombre.slice(0, dosPuntos)
  const espacio = prefijo === 'xmi' ? NS.xmi : prefijo === 'uml' ? NS.uml : null

  return ctx.doc.createElementNS(espacio, nombre)
}

const ponXmi = (elemento: Element, nombre: string, valor: string): void => {
  elemento.setAttributeNS(NS.xmi, `xmi:${nombre}`, valor)
}

/** Un hijo con atributos, que es la forma de casi toda la extensión de EA. */
function hijo(
  ctx: Ctx,
  padre: Element,
  nombre: string,
  attrs: Record<string, string | undefined> = {},
): Element {
  const elemento = crear(ctx, nombre)

  for (const [clave, valor] of Object.entries(attrs)) {
    if (valor !== undefined) elemento.setAttribute(clave, valor)
  }

  padre.appendChild(elemento)
  return elemento
}

// --- el modelo UML ---

function ponLimites(ctx: Ctx, padre: Element, multiplicidad: string | null, base: string): void {
  const limites = limitesDeMultiplicidad(multiplicidad)
  if (limites === null) return

  const inferior = crear(ctx, 'lowerValue')
  ponXmi(inferior, 'type', 'uml:LiteralInteger')
  ponXmi(inferior, 'id', idXmi(`${base}#lower`))
  inferior.setAttribute('value', limites.inferior)
  padre.appendChild(inferior)

  // EA escribe el infinito como -1, no como "*", y su importador espera eso.
  const esInfinito = limites.superior === '*'
  const superior = crear(ctx, 'upperValue')
  ponXmi(superior, 'type', esInfinito ? 'uml:LiteralUnlimitedNatural' : 'uml:LiteralInteger')
  ponXmi(superior, 'id', idXmi(`${base}#upper`))
  superior.setAttribute('value', esInfinito ? '-1' : limites.superior)
  padre.appendChild(superior)
}

function atributoUml(ctx: Ctx, propiedad: Property): Element {
  const elemento = crear(ctx, 'ownedAttribute')

  ponXmi(elemento, 'type', 'uml:Property')
  ponXmi(elemento, 'id', idXmi(propiedad.id))
  elemento.setAttribute('name', propiedad.name)
  elemento.setAttribute('visibility', VISIBILIDAD_XMI[propiedad.visibility])
  elemento.setAttribute('isStatic', String(propiedad.isStatic))
  elemento.setAttribute('isReadOnly', String(propiedad.isReadOnly))
  elemento.setAttribute('isDerived', String(propiedad.isDerived))
  elemento.setAttribute('isOrdered', String(propiedad.isOrdered))
  elemento.setAttribute('isUnique', String(propiedad.isUnique))
  elemento.setAttribute('isDerivedUnion', 'false')

  if (propiedad.type !== null && propiedad.type.trim() !== '') {
    const tipo = crear(ctx, 'type')
    tipo.setAttributeNS(NS.xmi, 'xmi:idref', `EAJava_${propiedad.type.trim()}`)
    elemento.appendChild(tipo)
  }

  ponLimites(ctx, elemento, propiedad.multiplicity ?? '1', propiedad.id)

  return elemento
}

function operacionUml(ctx: Ctx, op: Operation): Element {
  const elemento = crear(ctx, 'ownedOperation')

  ponXmi(elemento, 'type', 'uml:Operation')
  ponXmi(elemento, 'id', idXmi(op.id))
  elemento.setAttribute('name', op.name)
  elemento.setAttribute('visibility', VISIBILIDAD_XMI[op.visibility])
  elemento.setAttribute('isStatic', String(op.isStatic))
  elemento.setAttribute('isAbstract', String(op.isAbstract))
  elemento.setAttribute('isQuery', String(op.isQuery))

  const conTipo = (padre: Element, tipo: string | null): void => {
    if (tipo === null || tipo.trim() === '') return

    const referencia = crear(ctx, 'type')
    referencia.setAttributeNS(NS.xmi, 'xmi:idref', `EAJava_${tipo.trim()}`)
    padre.appendChild(referencia)
  }

  for (const parametro of op.parameters) {
    // UML modela un único retorno, y lo aporta `returnType`.
    if (parametro.direction === 'return') continue

    const hijoParam = crear(ctx, 'ownedParameter')
    ponXmi(hijoParam, 'type', 'uml:Parameter')
    ponXmi(hijoParam, 'id', idXmi(parametro.id))
    hijoParam.setAttribute('name', parametro.name)
    hijoParam.setAttribute('direction', parametro.direction)
    conTipo(hijoParam, parametro.type)
    elemento.appendChild(hijoParam)
  }

  if (op.returnType !== null && op.returnType.trim() !== '') {
    const retorno = crear(ctx, 'ownedParameter')
    ponXmi(retorno, 'type', 'uml:Parameter')
    ponXmi(retorno, 'id', idXmi(`${op.id}#return`))
    retorno.setAttribute('direction', 'return')
    conTipo(retorno, op.returnType)
    elemento.appendChild(retorno)
  }

  return elemento
}

function extremoUml(
  ctx: Ctx,
  arista: UmlEdge,
  lado: 'source' | 'target',
  nodoId: string,
  agregacion: string,
  /** El elemento que posee los extremos: la asociación, o la clase de asociación. */
  asociacionId: string,
): Element {
  const fin = arista.ends[lado]
  const base = `${arista.id}#${lado}`

  const elemento = crear(ctx, 'ownedEnd')
  ponXmi(elemento, 'type', 'uml:Property')
  ponXmi(elemento, 'id', idXmi(base))

  if (fin.role !== null && fin.role !== '') elemento.setAttribute('name', fin.role)

  elemento.setAttribute('visibility', VISIBILIDAD_XMI[fin.visibility ?? '+'])
  elemento.setAttribute('association', idXmi(asociacionId))
  elemento.setAttribute('isStatic', 'false')
  elemento.setAttribute('isReadOnly', 'true')
  elemento.setAttribute('isDerived', 'false')
  elemento.setAttribute('isOrdered', String(fin.isOrdered))
  elemento.setAttribute('isUnique', String(fin.isUnique))
  elemento.setAttribute('isDerivedUnion', 'false')
  elemento.setAttribute('aggregation', agregacion)

  const tipo = crear(ctx, 'type')
  tipo.setAttributeNS(NS.xmi, 'xmi:idref', idXmi(nodoId))
  elemento.appendChild(tipo)

  ponLimites(ctx, elemento, fin.multiplicity, base)

  return elemento
}

// --- coordenadas ---

type Caja = { izquierda: number; arriba: number; derecha: number; abajo: number }

/**
 * Las cajas trasladadas para que ninguna caiga en coordenadas negativas.
 *
 * El `viewport` del documento NO entra aquí: es la cámara del editor, no dónde están las
 * cosas. Mezclarlo movería el diagrama según por dónde estuviera mirando el usuario al
 * exportar.
 */
function cajasDe(
  documento: UmlDocument,
  diagramaId: string,
): { porNodo: Map<string, Caja>; minX: number; minY: number } {
  const nodos = Object.values(documento.nodes).filter((nodo) => nodo.diagramId === diagramaId)

  const minX = Math.min(...nodos.map((nodo) => nodo.position.x), 0)
  const minY = Math.min(...nodos.map((nodo) => nodo.position.y), 0)

  const porNodo = new Map<string, Caja>()

  for (const nodo of nodos) {
    const izquierda = Math.round(nodo.position.x - minX + MARGEN)
    const arriba = Math.round(nodo.position.y - minY + MARGEN)

    porNodo.set(nodo.id, {
      izquierda,
      arriba,
      derecha: izquierda + Math.round(nodo.size.width),
      abajo: arriba + Math.round(nodo.size.height ?? ALTO_NOMINAL),
    })
  }

  return { porNodo, minX, minY }
}

const geometriaDe = (caja: Caja): string =>
  `Left=${caja.izquierda};Top=${caja.arriba};Right=${caja.derecha};Bottom=${caja.abajo};`

/**
 * La geometría de una línea.
 *
 * Si el usuario la dobló a mano, los puntos de quiebre van en `Path=x:y$x:y$`, en el mismo
 * sistema trasladado que las cajas: con las coordenadas sin trasladar la línea apuntaría a
 * otro sitio distinto del que ocupan sus extremos.
 */
function geometriaDeLinea(
  arista: UmlEdge,
  desplazamiento: { x: number; y: number },
): string {
  const camino = arista.waypoints
    .map(
      (punto) =>
        `${Math.round(punto.x - desplazamiento.x + MARGEN)}:${Math.round(punto.y - desplazamiento.y + MARGEN)}`,
    )
    .join('$')

  // EDGE=2 en una relación de una clase consigo misma, que EA dibuja como bucle.
  return (
    `EDGE=${arista.source === arista.target ? 2 : 1};` +
    `$LLB=;LLT=;LMT=;LMB=;LRT=;LRB=;IRHS=;ILHS=;` +
    `Path=${camino === '' ? '' : `${camino}$`};`
  )
}

// --- la extensión de EA ---

/**
 * El paquete también va en el censo.
 *
 * EA lo incluye con cuatro hijos que ningún otro elemento lleva —`packageproperties`,
 * `paths`, `times` y `flags`— y es el contenedor del que cuelga el diagrama.
 */
function censoDelPaquete(ctx: Ctx, padre: Element, documento: UmlDocument): void {
  const elemento = crear(ctx, 'element')
  elemento.setAttributeNS(NS.xmi, 'xmi:idref', ID_PAQUETE)
  elemento.setAttributeNS(NS.xmi, 'xmi:type', 'uml:Package')
  elemento.setAttribute('name', documento.meta.name)
  elemento.setAttribute('scope', 'public')
  padre.appendChild(elemento)

  hijo(ctx, elemento, 'model', {
    package2: `EAID_${guidDe('paquete-raiz')}`,
    package: ID_PAQUETE,
    tpos: '0',
    ea_localid: '0',
    ea_eleType: 'package',
  })
  hijo(ctx, elemento, 'properties', {
    isSpecification: 'false',
    sType: 'Package',
    nType: '0',
    scope: 'public',
  })
  hijo(ctx, elemento, 'project', {
    author: 'Diagramador UML',
    version: '1.0',
    phase: '1.0',
    created: ctx.fecha,
    modified: ctx.fecha,
    complexity: '1',
    status: 'Proposed',
  })
  hijo(ctx, elemento, 'code', { gentype: 'Java' })
  hijo(ctx, elemento, 'style', { appearance: APARIENCIA })
  hijo(ctx, elemento, 'tags')
  hijo(ctx, elemento, 'xrefs', { value: '' })
  hijo(ctx, elemento, 'extendedProperties', { tagged: '0', package_name: documento.meta.name })
  hijo(ctx, elemento, 'packageproperties', { version: '1.0', tpos: '0' })
  hijo(ctx, elemento, 'paths')
  hijo(ctx, elemento, 'times', {
    created: ctx.fecha,
    modified: ctx.fecha,
    lastloaddate: ctx.fecha,
    lastsavedate: ctx.fecha,
  })
  hijo(ctx, elemento, 'flags', {
    iscontrolled: 'FALSE',
    isprotected: 'FALSE',
    batchsave: '0',
    batchload: '0',
    usedtd: 'FALSE',
    logxml: 'FALSE',
  })
}

function censoDeElemento(ctx: Ctx, padre: Element, nodo: UmlNode, documento: UmlDocument): void {
  const elemento = crear(ctx, 'element')
  elemento.setAttributeNS(NS.xmi, 'xmi:idref', idXmi(nodo.id))
  elemento.setAttributeNS(NS.xmi, 'xmi:type', TIPO_XMI_POR_CLASIFICADOR[nodo.kind] ?? 'uml:Class')
  elemento.setAttribute('name', nodo.name)
  elemento.setAttribute('scope', 'public')
  padre.appendChild(elemento)

  hijo(ctx, elemento, 'model', {
    package2: `EAID_${guidDe('paquete-raiz')}`,
    package: ID_PAQUETE,
    tpos: '0',
    ea_localid: String(ctx.localId.get(nodo.id) ?? 0),
    ea_eleType: 'element',
  })

  hijo(ctx, elemento, 'properties', {
    isSpecification: 'false',
    sType: nodo.kind === 'interface' ? 'Interface' : 'Class',
    // 17 es como EA marca una clase que es la clase de una asociación.
    nType: nodo.associationId === null ? '0' : '17',
    scope: 'public',
    isRoot: 'false',
    isLeaf: 'false',
    isAbstract: String(nodo.isAbstract),
    isActive: 'false',
  })

  hijo(ctx, elemento, 'project', {
    author: 'Diagramador UML',
    version: '1.0',
    phase: '1.0',
    created: ctx.fecha,
    modified: ctx.fecha,
    complexity: '1',
    status: 'Proposed',
  })

  hijo(ctx, elemento, 'code', { gentype: 'Java' })
  hijo(ctx, elemento, 'style', { appearance: APARIENCIA })
  hijo(ctx, elemento, 'tags')
  hijo(ctx, elemento, 'xrefs', { value: '' })
  hijo(ctx, elemento, 'extendedProperties', {
    tagged: '0',
    package_name: documento.meta.name,
    conID: nodo.associationId === null ? undefined : idXmi(nodo.associationId),
  })

  const atributos = (nodo.compartments.attributes ?? []).filter(
    (miembro): miembro is Property => miembro.kind === 'property',
  )

  if (atributos.length > 0) {
    const contenedor = hijo(ctx, elemento, 'attributes')

    atributos.forEach((propiedad, indice) => {
      const limites = limitesDeMultiplicidad(propiedad.multiplicity ?? '1')

      const entrada = crear(ctx, 'attribute')
      entrada.setAttributeNS(NS.xmi, 'xmi:idref', idXmi(propiedad.id))
      entrada.setAttribute('name', propiedad.name)
      entrada.setAttribute('scope', propiedad.visibility === '+' ? 'Public' : 'Private')
      contenedor.appendChild(entrada)

      hijo(ctx, entrada, 'initial')
      hijo(ctx, entrada, 'documentation')
      hijo(ctx, entrada, 'model', {
        ea_localid: String(indice + 1),
        ea_guid: `{${guidDe(propiedad.id).replace(/_/g, '-')}}`,
      })
      hijo(ctx, entrada, 'properties', {
        // El tipo del atributo va AQUÍ, no solo en el `<type>` de `ownedAttribute`. EA
        // reconstruye su modelo desde este censo, no desde la parte UML estándar: sin este
        // atributo las clases entran con todos sus campos sin tipo, sin que nada falle.
        // Se omite cuando no hay tipo, que es lo que hace EA (ver `fixtures/ea-xmi21.xmi`,
        // cuyos atributos son todos sin tipo y no llevan el atributo).
        type:
          propiedad.type === null || propiedad.type.trim() === ''
            ? undefined
            : propiedad.type.trim(),
        derived: propiedad.isDerived ? '1' : '0',
        precision: '0',
        collection: 'false',
        length: '0',
        static: propiedad.isStatic ? '1' : '0',
        duplicates: propiedad.isUnique ? '0' : '1',
        changeability: propiedad.isReadOnly ? 'frozen' : 'changeable',
      })
      hijo(ctx, entrada, 'coords', { ordered: propiedad.isOrdered ? '1' : '0', scale: '0' })
      // `position` es el orden en que se escribieron: sin esto salen alfabéticos.
      hijo(ctx, entrada, 'containment', { position: String(indice) })
      hijo(ctx, entrada, 'stereotype')
      hijo(ctx, entrada, 'bounds', {
        lower: limites?.inferior ?? '1',
        upper: limites?.superior === '*' ? '-1' : (limites?.superior ?? '1'),
      })
      hijo(ctx, entrada, 'options')
      hijo(ctx, entrada, 'style')
      hijo(ctx, entrada, 'styleex', {
        // El `{id}` de UML 2.5 no tiene hueco propio en el formato de EA. Va dentro de esta
        // bolsa de clave=valor, que ya existe: añadir un atributo o un elemento nuevo es lo
        // que hace que su importador descarte lo que lo contiene.
        value: `IsLiteral=0;${propiedad.isId ? 'IsID=1;' : ''}`,
      })
      hijo(ctx, entrada, 'tags')
      hijo(ctx, entrada, 'xrefs')
    })
  }

  // `links` es cómo EA declara con qué está conectado cada elemento.
  const suyas = Object.values(documento.edges).filter(
    (arista) => arista.source === nodo.id || arista.target === nodo.id,
  )

  if (suyas.length > 0) {
    const enlaces = hijo(ctx, elemento, 'links')

    for (const arista of suyas) {
      hijo(ctx, enlaces, arista.kind === 'generalization' ? 'Generalization' : 'Association', {
        id: idXmi(arista.id),
        start: idXmi(arista.source),
        end: idXmi(arista.target),
      })
    }
  }
}

function censoDeConector(ctx: Ctx, padre: Element, arista: UmlEdge, documento: UmlDocument): void {
  const conector = crear(ctx, 'connector')
  conector.setAttributeNS(NS.xmi, 'xmi:idref', idXmi(arista.id))
  if (arista.name !== null && arista.name !== '') conector.setAttribute('name', arista.name)
  padre.appendChild(conector)

  const clase = ctx.claseDeArista.get(arista.id)

  for (const lado of ['source', 'target'] as const) {
    const fin = arista.ends[lado]
    const nodoId = lado === 'source' ? arista.source : arista.target

    const extremo = crear(ctx, lado)
    extremo.setAttributeNS(NS.xmi, 'xmi:idref', idXmi(nodoId))
    conector.appendChild(extremo)

    hijo(ctx, extremo, 'model', {
      ea_localid: String(ctx.localId.get(nodoId) ?? 0),
      type: 'Class',
      name: documento.nodes[nodoId]?.name ?? '',
    })
    hijo(ctx, extremo, 'role', { visibility: 'Public' })
    hijo(ctx, extremo, 'type', {
      multiplicity: fin.multiplicity ?? undefined,
      // En SU extensión EA anota la agregación en el extremo del TODO, que es el origen.
      // En el modelo UML va en el de la parte. Dos convenios opuestos, el mismo fichero.
      aggregation: lado === 'source' ? (AGREGACION_EN_DESTINO[arista.kind] ?? 'none') : 'none',
    })
    hijo(ctx, extremo, 'constraints')
    hijo(ctx, extremo, 'modifiers', {
      isOrdered: String(fin.isOrdered),
      isNavigable: String(fin.navigable === true),
    })
    /**
     * `Navigable` admite tres valores, y es el único sitio donde cabe el tercero: UML
     * distingue "no navegable" de "no se dijo", y el `isNavigable` de `<modifiers>` es un
     * booleano que no puede expresarlo.
     */
    const navegabilidad =
      fin.navigable === null ? 'Unspecified' : fin.navigable ? 'Navigable' : 'Non-Navigable'

    hijo(ctx, extremo, 'style', {
      value: `Derived=0;Union=0;AllowDuplicates=0;Owned=0;Navigable=${navegabilidad};`,
    })
    hijo(ctx, extremo, 'documentation')
    hijo(ctx, extremo, 'xrefs')
    hijo(ctx, extremo, 'tags')
  }

  hijo(ctx, conector, 'model', { ea_localid: String(ctx.localId.get(arista.id) ?? 0) })
  hijo(ctx, conector, 'properties', {
    ea_type: EA_TYPE[arista.kind] ?? 'Association',
    direction: arista.kind === 'directed-association' ? 'Source -> Destination' : 'Unspecified',
    subtype: clase === undefined ? undefined : 'Class',
  })
  hijo(ctx, conector, 'modifiers', { isRoot: 'false', isLeaf: 'false' })
  hijo(ctx, conector, 'documentation')
  hijo(ctx, conector, 'appearance', {
    linemode: '3',
    linecolor: '0',
    linewidth: '0',
    seqno: '0',
    headStyle: '0',
    lineStyle: '0',
  })
  hijo(ctx, conector, 'labels', {
    lb: arista.ends.source.multiplicity ?? undefined,
    rb: arista.ends.target.multiplicity ?? undefined,
    mt: arista.name ?? undefined,
  })
  hijo(ctx, conector, 'extendedProperties', {
    associationclass: clase === undefined ? undefined : idXmi(clase.id),
    privatedata1: clase === undefined ? undefined : String(ctx.localId.get(clase.id) ?? 0),
    virtualInheritance: arista.kind === 'generalization' ? '0' : undefined,
  })
  hijo(ctx, conector, 'style')
  hijo(ctx, conector, 'xrefs', { value: '' })
  hijo(ctx, conector, 'tags')
  hijo(ctx, conector, 'parameterSubstitutions')
}

export function documentToXmi(documento: UmlDocument): string {
  const xml = globalThis.document.implementation.createDocument(NS.xmi, 'xmi:XMI', null)
  const raiz = xml.documentElement

  const ctx: Ctx = {
    doc: xml,
    localId: new Map(),
    claseDeArista: new Map(),
    fecha: documento.meta.updatedAt.slice(0, 19).replace('T', ' '),
  }

  for (const nodo of Object.values(documento.nodes)) {
    if (nodo.associationId !== null) ctx.claseDeArista.set(nodo.associationId, nodo)
  }

  let siguiente = 1
  for (const nodo of Object.values(documento.nodes)) ctx.localId.set(nodo.id, siguiente++)
  for (const arista of Object.values(documento.edges)) ctx.localId.set(arista.id, siguiente++)

  raiz.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:uml', NS.uml)
  ponXmi(raiz, 'version', XMI_VERSION)

  const documentacion = crear(ctx, 'xmi:Documentation')
  documentacion.setAttribute('exporter', 'Enterprise Architect')
  documentacion.setAttribute('exporterVersion', '6.5')
  raiz.appendChild(documentacion)

  // --- 1. el modelo UML ---

  const modelo = crear(ctx, 'uml:Model')
  ponXmi(modelo, 'type', 'uml:Model')
  modelo.setAttribute('name', 'EA_Model')
  modelo.setAttribute('visibility', 'public')
  raiz.appendChild(modelo)

  const paquete = crear(ctx, 'packagedElement')
  ponXmi(paquete, 'type', 'uml:Package')
  ponXmi(paquete, 'id', ID_PAQUETE)
  paquete.setAttribute('name', documento.meta.name)
  paquete.setAttribute('visibility', 'public')
  modelo.appendChild(paquete)

  const elementoPorNodo = new Map<string, Element>()

  const clasificador = (nodo: UmlNode, tipo: string, id: string): Element => {
    const elemento = crear(ctx, 'packagedElement')

    ponXmi(elemento, 'type', tipo)
    ponXmi(elemento, 'id', id)
    elemento.setAttribute('name', nodo.name)
    elemento.setAttribute('visibility', VISIBILIDAD_XMI[nodo.visibility])

    for (const miembro of nodo.compartments.attributes ?? []) {
      if (miembro.kind === 'property') elemento.appendChild(atributoUml(ctx, miembro))
    }
    for (const miembro of nodo.compartments.operations ?? []) {
      if (miembro.kind === 'operation') elemento.appendChild(operacionUml(ctx, miembro))
    }

    return elemento
  }

  for (const nodo of Object.values(documento.nodes)) {
    // La clase de una asociación no se escribe aparte: se funde con su arista en un único
    // uml:AssociationClass, que es lo que modela UML 2.5 y lo que EA espera encontrar.
    if (nodo.associationId !== null) continue

    const elemento = clasificador(
      nodo,
      TIPO_XMI_POR_CLASIFICADOR[nodo.kind] ?? 'uml:Class',
      idXmi(nodo.id),
    )
    elementoPorNodo.set(nodo.id, elemento)
    paquete.appendChild(elemento)
  }

  for (const arista of Object.values(documento.edges)) {
    if (arista.kind === 'generalization') {
      // Va ANIDADA dentro de la subclase, que es nuestro origen.
      const dentro = elementoPorNodo.get(arista.source)
      if (!dentro) continue

      const general = crear(ctx, 'generalization')
      ponXmi(general, 'type', 'uml:Generalization')
      ponXmi(general, 'id', idXmi(arista.id))
      general.setAttribute('general', idXmi(arista.target))
      dentro.appendChild(general)
      continue
    }

    if (arista.kind === 'realization') {
      const realizacion = crear(ctx, 'packagedElement')
      ponXmi(realizacion, 'type', 'uml:Realization')
      ponXmi(realizacion, 'id', idXmi(arista.id))
      realizacion.setAttribute('client', idXmi(arista.source))
      realizacion.setAttribute('supplier', idXmi(arista.target))
      paquete.appendChild(realizacion)
      continue
    }

    const clase = ctx.claseDeArista.get(arista.id)

    const elemento =
      clase === undefined
        ? crear(ctx, 'packagedElement')
        : clasificador(clase, 'uml:AssociationClass', idXmi(clase.id))

    if (clase === undefined) {
      ponXmi(elemento, 'type', 'uml:Association')
      ponXmi(elemento, 'id', idXmi(arista.id))
      if (arista.name !== null && arista.name !== '') elemento.setAttribute('name', arista.name)
      elemento.setAttribute('visibility', 'public')
    }

    /**
     * El orden de `memberEnd` es el de EA: primero el destino. No es capricho —así lo
     * escribe su exportador— y respetarlo es lo que evita que la relación vuelva invertida.
     */
    for (const lado of ['target', 'source'] as const) {
      const miembro = crear(ctx, 'memberEnd')
      miembro.setAttributeNS(NS.xmi, 'xmi:idref', idXmi(`${arista.id}#${lado}`))
      elemento.appendChild(miembro)
    }

    const duenoDeExtremos = clase === undefined ? arista.id : clase.id

    elemento.appendChild(
      extremoUml(ctx, arista, 'source', arista.source, 'none', duenoDeExtremos),
    )
    elemento.appendChild(
      extremoUml(
        ctx,
        arista,
        'target',
        arista.target,
        AGREGACION_EN_DESTINO[arista.kind] ?? 'none',
        duenoDeExtremos,
      ),
    )

    paquete.appendChild(elemento)
  }

  // --- 2. la extensión de EA: el censo, los conectores y el diagrama ---

  const extension = crear(ctx, 'xmi:Extension')
  extension.setAttribute('extender', 'Enterprise Architect')
  extension.setAttribute('extenderID', '6.5')
  raiz.appendChild(extension)

  const censo = crear(ctx, 'elements')
  extension.appendChild(censo)

  censoDelPaquete(ctx, censo, documento)
  for (const nodo of Object.values(documento.nodes)) censoDeElemento(ctx, censo, nodo, documento)

  const conectores = crear(ctx, 'connectors')
  extension.appendChild(conectores)

  for (const arista of Object.values(documento.edges)) {
    censoDeConector(ctx, conectores, arista, documento)
  }

  const primitivos = hijo(ctx, extension, 'primitivetypes')
  const paquetePrimitivo = hijo(ctx, primitivos, 'packagedElement', {
    name: 'EA_PrimitiveTypes_Package',
    visibility: 'public',
  })
  ponXmi(paquetePrimitivo, 'type', 'uml:Package')
  ponXmi(paquetePrimitivo, 'id', 'EAPrimitiveTypesPackage')
  hijo(ctx, extension, 'profiles')

  const diagramas = crear(ctx, 'diagrams')
  extension.appendChild(diagramas)

  for (const vista of documento.diagrams) {
    const { porNodo, minX, minY } = cajasDe(documento, vista.id)

    const diagrama = crear(ctx, 'diagram')
    ponXmi(diagrama, 'id', idXmi(vista.id))
    diagramas.appendChild(diagrama)

    hijo(ctx, diagrama, 'model', { package: ID_PAQUETE, localID: '1', owner: ID_PAQUETE })
    hijo(ctx, diagrama, 'properties', { name: vista.name, type: 'Logical' })
    hijo(ctx, diagrama, 'project', {
      author: 'Diagramador UML',
      version: '1.0',
      created: ctx.fecha,
      modified: ctx.fecha,
    })
    hijo(ctx, diagrama, 'style1', {
      value:
        'ShowPrivate=1;ShowProtected=1;ShowPublic=1;HideRelationships=0;Locked=0;Border=1;' +
        'HighlightForeign=1;PackageContents=1;SequenceNotes=0;ScalePrintImage=0;PPgs.cx=0;' +
        'PPgs.cy=0;DocSize.cx=850;DocSize.cy=1098;ShowDetails=0;Orientation=P;Zoom=100;' +
        'ShowTags=0;OpParams=1;VisibleAttributeDetail=0;ShowOpRetType=1;ShowIcons=1;' +
        'CollabNums=0;HideProps=0;ShowReqs=0;ShowCons=0;PaperSize=1;HideParents=0;UseAlias=0;' +
        'HideAtts=0;HideOps=0;HideStereo=0;HideElemStereo=0;ShowTests=0;ShowMaint=0;' +
        'ConnectorNotation=UML 2.1;ExplicitNavigability=0;ShowShape=1;AllDockable=0;SPT=1;' +
        'ShowNotes=0;SuppressBrackets=0;SuppConnectorLabels=0;PrintPageHeadFoot=0;ShowAsList=0;',
    })
    hijo(ctx, diagrama, 'style2', {
      value:
        'ExcludeRTF=0;DocAll=0;HideQuals=0;AttPkg=1;ShowTests=0;ShowMaint=0;SuppressFOC=1;' +
        'MatrixActive=0;SwimlanesActive=1;KanbanActive=0;MatrixLineWidth=1;MatrixLineClr=0;' +
        'MatrixLocked=0;TConnectorNotation=UML 2.1;TExplicitNavigability=0;SPT=1;ShowNotes=0;' +
        'VisibleAttributeDetail=0;ShowOpRetType=1;SuppressBrackets=0;SuppConnectorLabels=0;' +
        'PrintPageHeadFoot=0;ShowAsList=0;SuppressedCompartments=;',
    })
    hijo(ctx, diagrama, 'swimlanes', {
      value:
        'locked=false;orientation=0;width=0;inbar=false;names=false;color=-1;bold=false;fcol=0;' +
        'tcol=-1;ofCol=-1;ufCol=-1;hl=0;ufh=0;hh=0;cls=0;bw=0;hli=0;',
    })
    hijo(ctx, diagrama, 'matrixitems', {
      value:
        'locked=false;matrixactive=false;swimlanesactive=true;kanbanactive=false;width=1;clrLine=0;',
    })
    hijo(ctx, diagrama, 'extendedProperties')

    const elementos = crear(ctx, 'elements')
    diagrama.appendChild(elementos)

    let orden = 1

    for (const nodo of Object.values(documento.nodes)) {
      const caja = porNodo.get(nodo.id)
      if (caja === undefined) continue

      hijo(ctx, elementos, 'element', {
        geometry: geometriaDe(caja),
        subject: idXmi(nodo.id),
        seqno: String(orden),
        style: `DUID=${duid(nodo.id)};${ESTILO_CAJA}`,
      })

      orden += 1
    }

    /**
     * Las líneas también son elementos del diagrama. EA las enlaza con las cajas por el
     * DUID: `SOID` es la del origen y `EOID` la del destino. Sin esta parte el diagrama trae
     * las cajas y ninguna relación entre ellas.
     */
    for (const arista of Object.values(documento.edges)) {
      if (arista.diagramId !== vista.id) continue

      hijo(ctx, elementos, 'element', {
        geometry: geometriaDeLinea(arista, { x: minX, y: minY }),
        subject: idXmi(arista.id),
        style: `Mode=3;EOID=${duid(arista.target)};SOID=${duid(arista.source)};Color=-1;LWidth=0;Hidden=0;`,
      })
    }
  }

  const texto = new XMLSerializer().serializeToString(xml)
  return `<?xml version="1.0" encoding="UTF-8"?>\n${texto}\n`
}
