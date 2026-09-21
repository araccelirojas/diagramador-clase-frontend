/**
 * Documento -> XMI 1.1 con metamodelo UML 1.3, que es lo que Enterprise Architect exporta
 * e importa por defecto.
 *
 * Se escribe imitando un fichero real exportado por EA, no deduciéndolo de la
 * especificación: el orden de los elementos, las `<UML:TaggedValue>` y los `ea_localid` son
 * lo que su importador busca.
 *
 * Dos cosas que no se pueden equivocar:
 *
 * 1. El diagrama es `<UML:Diagram>` dentro de `<XMI.content>`, hermano del modelo. No va en
 *    ninguna extensión. Ahí es donde viven las posiciones.
 * 2. UML 1.3 pone el rombo de la agregación en el extremo del TODO, al revés que UML 2.x.
 *    Como nuestro origen ES el todo, aquí se marca el extremo de ORIGEN.
 */

import { guidDe } from '@/io/xmi/exportXmi'
import { VISIBILIDAD_XMI } from '@/io/xmi/nomenclatura'
import type { Operation, Property, UmlDocument, UmlNode } from '@/uml/model/types'

const ESPACIO_UML = 'omg.org/UML1.3'

/** EA se identifica así en los ficheros que exporta; su importador lo espera. */
const HERRAMIENTA = 'Enterprise Architect 2.5'

/** La clase técnica que EA mete en todo modelo, con un id fijo suyo. */
const RAIZ_EA = 'EAID_11111111_5487_4080_A7F4_41526CB0AA00'

/** El DataType sin nombre al que EA apunta cuando un atributo no tiene tipo. */
const SIN_TIPO = 'eaxmiid0'

const ALTO_NOMINAL = 90

const idEa = (id: string): string => `EAID_${guidDe(id)}`
const idPaquete = (nombre: string): string => `EAPK_${guidDe(nombre)}`

/**
 * El id del modelo.
 *
 * EA lo deriva del MISMO guid que el paquete, cambiando el prefijo: `EAPK_abc` va con
 * `MX_EAID_abc`. Componerlo de otra forma produce un fichero que se lee igual pero que no
 * sigue su convenio.
 */
const idModelo = (nombre: string): string => `MX_EAID_${guidDe(nombre)}`

/** El identificador corto que EA usa para enlazar una línea con las cajas que une. */
const duid = (id: string): string => guidDe(id).slice(0, 8)

/** Cómo EA escribe la agregación en UML 1.3: en el extremo del todo. */
const AGREGACION: Record<string, string> = {
  composition: 'composite',
  aggregation: 'shared',
}

const ea_type: Record<string, string> = {
  association: 'Association',
  'directed-association': 'Association',
  aggregation: 'Aggregation',
  composition: 'Aggregation',
  generalization: 'Generalization',
  realization: 'Realisation',
  'association-class': 'Association',
}

/**
 * Lo nuestro que necesita sobrevivir a la ida y vuelta, en forma de etiqueta.
 *
 * El `xmi.id` que ve EA es un hash de nuestro id, y un hash no se deshace; sin esto,
 * reimportar nuestro propio fichero daría un documento equivalente con todos los ids
 * cambiados.
 *
 * Va como `<UML:TaggedValue>` y NO como una extensión propia ni como un atributo inventado:
 * las etiquetas son el mecanismo de extensión del propio EA y admiten claves ajenas, pero un
 * elemento o un atributo que su importador no conoce hace que descarte lo que lo contiene.
 * Eso era exactamente lo que dejaba el diagrama sin colocar.
 */
const nuestrasEtiquetas = (id: string): Record<string, string> => ({ diagramador_id: id })

type Ctx = {
  doc: XMLDocument
  /** EA numera sus elementos con un entero por modelo y los referencia por él. */
  localId: Map<string, number>
}

const crear = (ctx: Ctx, nombre: string): Element =>
  ctx.doc.createElementNS(nombre.startsWith('UML:') ? ESPACIO_UML : null, nombre)

/** `<UML:ModelElement.taggedValue>` con todo lo que EA guarda fuera de la estructura. */
function ponEtiquetas(ctx: Ctx, padre: Element, valores: Record<string, string | undefined>): void {
  const contenedor = crear(ctx, 'UML:ModelElement.taggedValue')

  for (const [tag, value] of Object.entries(valores)) {
    if (value === undefined) continue

    const etiqueta = crear(ctx, 'UML:TaggedValue')
    etiqueta.setAttribute('tag', tag)
    etiqueta.setAttribute('value', value)
    contenedor.appendChild(etiqueta)
  }

  padre.appendChild(contenedor)
}

const ESTILO_CAJA =
  'BackColor=-1;BorderColor=-1;BorderWidth=-1;FontColor=-1;VSwimLanes=1;HSwimLanes=1;BorderStyle=0;'

function atributo(ctx: Ctx, propiedad: Property, posicion: number, idTipo: string): Element {
  const elemento = crear(ctx, 'UML:Attribute')

  elemento.setAttribute('name', propiedad.name)
  elemento.setAttribute('changeable', propiedad.isReadOnly ? 'frozen' : 'none')
  elemento.setAttribute('visibility', VISIBILIDAD_XMI[propiedad.visibility])
  elemento.setAttribute('ownerScope', propiedad.isStatic ? 'classifier' : 'instance')
  elemento.setAttribute('targetScope', 'instance')

  const inicial = crear(ctx, 'UML:Attribute.initialValue')
  const expresion = crear(ctx, 'UML:Expression')
  if (propiedad.defaultValue !== null) expresion.setAttribute('body', propiedad.defaultValue)
  inicial.appendChild(expresion)
  elemento.appendChild(inicial)

  const tipo = crear(ctx, 'UML:StructuralFeature.type')
  const clasificador = crear(ctx, 'UML:Classifier')
  clasificador.setAttribute('xmi.idref', idTipo)
  tipo.appendChild(clasificador)
  elemento.appendChild(tipo)

  // UML 1.3 no guarda "0..*": guarda los dos límites por separado, como etiquetas.
  const [inferior, superior] = limites(propiedad.multiplicity)

  ponEtiquetas(ctx, elemento, {
    derived: propiedad.isDerived ? '1' : '0',
    ordered: propiedad.isOrdered ? '1' : '0',
    static: propiedad.isStatic ? '1' : '0',
    collection: 'false',
    position: String(posicion),
    lowerBound: inferior,
    upperBound: superior,
    duplicates: propiedad.isUnique ? '0' : '1',
    // `{id}` de UML 2.5: EA no tiene campo propio, así que viaja como etiqueta.
    isID: propiedad.isId ? '1' : undefined,
    ea_guid: `{${guidDe(propiedad.id).replace(/_/g, '-')}}`,
    styleex: 'IsLiteral=0;',
  })

  return elemento
}

/** `0..*` partido en los dos límites que guarda UML 1.3. */
function limites(multiplicidad: string | null): [string, string] {
  if (multiplicidad === null || multiplicidad.trim() === '') return ['1', '1']

  const texto = multiplicidad.trim()
  const partes = texto.split('..')

  if (partes.length === 1) {
    const solo = partes[0]!.trim()
    return solo === '*' ? ['0', '*'] : [solo, solo]
  }

  return [partes[0]!.trim(), partes[1]!.trim()]
}

function operacion(ctx: Ctx, op: Operation, posicion: number, idTipo: (t: string | null) => string): Element {
  const elemento = crear(ctx, 'UML:Operation')

  elemento.setAttribute('name', op.name)
  elemento.setAttribute('visibility', VISIBILIDAD_XMI[op.visibility])
  elemento.setAttribute('ownerScope', op.isStatic ? 'classifier' : 'instance')
  elemento.setAttribute('isQuery', String(op.isQuery))
  elemento.setAttribute('isAbstract', String(op.isAbstract))

  const contenedor = crear(ctx, 'UML:BehavioralFeature.parameter')

  for (const parametro of op.parameters) {
    if (parametro.direction === 'return') continue

    const hijo = crear(ctx, 'UML:Parameter')
    hijo.setAttribute('name', parametro.name)
    hijo.setAttribute('kind', parametro.direction)

    const tipo = crear(ctx, 'UML:StructuralFeature.type')
    const clasificador = crear(ctx, 'UML:Classifier')
    clasificador.setAttribute('xmi.idref', idTipo(parametro.type))
    tipo.appendChild(clasificador)
    hijo.appendChild(tipo)

    contenedor.appendChild(hijo)
  }

  if (op.returnType !== null && op.returnType.trim() !== '') {
    const retorno = crear(ctx, 'UML:Parameter')
    retorno.setAttribute('name', 'return')
    retorno.setAttribute('kind', 'return')

    const tipo = crear(ctx, 'UML:StructuralFeature.type')
    const clasificador = crear(ctx, 'UML:Classifier')
    clasificador.setAttribute('xmi.idref', idTipo(op.returnType))
    tipo.appendChild(clasificador)
    retorno.appendChild(tipo)

    contenedor.appendChild(retorno)
  }

  elemento.appendChild(contenedor)

  ponEtiquetas(ctx, elemento, {
    static: op.isStatic ? '1' : '0',
    pos: String(posicion),
    ea_guid: `{${guidDe(op.id).replace(/_/g, '-')}}`,
  })

  return elemento
}

export function documentToEa11(documento: UmlDocument): string {
  const xml = document.implementation.createDocument(null, 'XMI', null)
  const raiz = xml.documentElement
  const ctx: Ctx = { doc: xml, localId: new Map() }

  raiz.setAttribute('xmi.version', '1.1')
  raiz.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:UML', ESPACIO_UML)
  raiz.setAttribute('timestamp', documento.meta.updatedAt.slice(0, 19).replace('T', ' '))

  // --- cabecera ---

  const cabecera = crear(ctx, 'XMI.header')
  const documentacion = crear(ctx, 'XMI.documentation')
  const exportador = crear(ctx, 'XMI.exporter')
  exportador.textContent = 'Diagramador UML'
  const versionExportador = crear(ctx, 'XMI.exporterVersion')
  versionExportador.textContent = '1.0'
  documentacion.appendChild(exportador)
  documentacion.appendChild(versionExportador)
  cabecera.appendChild(documentacion)
  raiz.appendChild(cabecera)

  const contenido = crear(ctx, 'XMI.content')
  raiz.appendChild(contenido)

  // EA numera cada elemento y las relaciones se refieren a esos números.
  let siguiente = 1
  for (const nodo of Object.values(documento.nodes)) ctx.localId.set(nodo.id, siguiente++)
  for (const arista of Object.values(documento.edges)) ctx.localId.set(arista.id, siguiente++)

  // --- los tipos: en UML 1.3 son elementos aparte a los que se apunta ---

  const tipos = new Map<string, string>()

  const idDeTipo = (texto: string | null): string => {
    if (texto === null || texto.trim() === '') return SIN_TIPO

    const limpio = texto.trim()
    const existente = tipos.get(limpio)
    if (existente !== undefined) return existente

    const nuevo = `eaxmiid${tipos.size + 1}`
    tipos.set(limpio, nuevo)
    return nuevo
  }

  // --- modelo ---

  const modelo = crear(ctx, 'UML:Model')
  modelo.setAttribute('name', 'EA Model')
  modelo.setAttribute('xmi.id', idModelo(documento.meta.name))
  contenido.appendChild(modelo)

  const contenidoModelo = crear(ctx, 'UML:Namespace.ownedElement')
  modelo.appendChild(contenidoModelo)

  const raizEa = crear(ctx, 'UML:Class')
  raizEa.setAttribute('name', 'EARootClass')
  raizEa.setAttribute('xmi.id', RAIZ_EA)
  raizEa.setAttribute('isRoot', 'true')
  raizEa.setAttribute('isLeaf', 'false')
  raizEa.setAttribute('isAbstract', 'false')
  contenidoModelo.appendChild(raizEa)

  const idPaq = idPaquete(documento.meta.name)
  const paquete = crear(ctx, 'UML:Package')
  paquete.setAttribute('name', documento.meta.name)
  paquete.setAttribute('xmi.id', idPaq)
  paquete.setAttribute('isRoot', 'false')
  paquete.setAttribute('isLeaf', 'false')
  paquete.setAttribute('isAbstract', 'false')
  paquete.setAttribute('visibility', 'public')
  contenidoModelo.appendChild(paquete)

  ponEtiquetas(ctx, paquete, {
    created: documento.meta.createdAt.slice(0, 19).replace('T', ' '),
    modified: documento.meta.updatedAt.slice(0, 19).replace('T', ' '),
    iscontrolled: 'FALSE',
    version: '1.0',
    isprotected: 'FALSE',
    packageFlags: 'CRC=0;',
    phase: '1.0',
    status: 'Proposed',
    complexity: '1',
    ea_stype: 'Public',
    tpos: '0',
    gentype: 'Java',
  })

  const dentroDelPaquete = crear(ctx, 'UML:Namespace.ownedElement')
  paquete.appendChild(dentroDelPaquete)

  /** La clase de asociación de cada arista, para poder enlazarlas en los dos sentidos. */
  const claseDeArista = new Map<string, UmlNode>()
  for (const nodo of Object.values(documento.nodes)) {
    if (nodo.associationId !== null) claseDeArista.set(nodo.associationId, nodo)
  }

  for (const nodo of Object.values(documento.nodes)) {
    const elemento = crear(ctx, nodo.kind === 'interface' ? 'UML:Interface' : 'UML:Class')

    elemento.setAttribute('name', nodo.name)
    elemento.setAttribute('xmi.id', idEa(nodo.id))
    elemento.setAttribute('visibility', VISIBILIDAD_XMI[nodo.visibility])
    elemento.setAttribute('namespace', idPaq)
    elemento.setAttribute('isRoot', 'false')
    elemento.setAttribute('isLeaf', 'false')
    elemento.setAttribute('isAbstract', String(nodo.isAbstract))
    elemento.setAttribute('isActive', 'false')

    ponEtiquetas(ctx, elemento, {
      isSpecification: 'false',
      ea_stype: nodo.kind === 'interface' ? 'Interface' : 'Class',
      // 17 es como EA marca una clase que es la clase de una asociación.
      ea_ntype: nodo.associationId === null ? '0' : '17',
      version: '1.0',
      package: idPaq,
      gentype: 'Java',
      tagged: '0',
      package_name: documento.meta.name,
      phase: '1.0',
      complexity: '1',
      status: 'Proposed',
      tpos: '0',
      ea_localid: String(ctx.localId.get(nodo.id) ?? 0),
      ea_eleType: 'element',
      conID: nodo.associationId === null ? undefined : idEa(nodo.associationId),
      stereotype: nodo.keywords.length > 0 ? nodo.keywords.join(',') : undefined,
      style: ESTILO_CAJA,
      ...nuestrasEtiquetas(nodo.id),
      // El alto "el que pida el contenido" no existe en EA: la geometría obliga a escribir
      // un número. Se anota aquí para recuperarlo al reimportar.
      diagramador_alto: nodo.size.height === null ? 'auto' : undefined,
    })

    const atributos = (nodo.compartments.attributes ?? []).filter(
      (miembro): miembro is Property => miembro.kind === 'property',
    )
    const operaciones = (nodo.compartments.operations ?? []).filter(
      (miembro): miembro is Operation => miembro.kind === 'operation',
    )

    if (atributos.length > 0 || operaciones.length > 0) {
      const rasgos = crear(ctx, 'UML:Classifier.feature')

      atributos.forEach((propiedad, indice) => {
        rasgos.appendChild(atributo(ctx, propiedad, indice, idDeTipo(propiedad.type)))
      })
      operaciones.forEach((op, indice) => {
        rasgos.appendChild(operacion(ctx, op, indice, idDeTipo))
      })

      elemento.appendChild(rasgos)
    }

    dentroDelPaquete.appendChild(elemento)
  }

  // --- relaciones ---

  const nombreDe = (id: string): string => documento.nodes[id]?.name ?? ''
  const localDe = (id: string): string => String(ctx.localId.get(id) ?? 0)

  for (const arista of Object.values(documento.edges)) {
    const comunes = {
      ...nuestrasEtiquetas(arista.id),
      style: '3',
      ea_type: ea_type[arista.kind] ?? 'Association',
      direction: arista.kind === 'directed-association' ? 'Source -> Destination' : 'Unspecified',
      linemode: '3',
      linecolor: '0',
      linewidth: '0',
      seqno: '0',
      headStyle: '0',
      lineStyle: '0',
      ea_localid: localDe(arista.id),
      ea_sourceName: nombreDe(arista.source),
      ea_targetName: nombreDe(arista.target),
      ea_sourceType: 'Class',
      ea_targetType: 'Class',
      ea_sourceID: localDe(arista.source),
      ea_targetID: localDe(arista.target),
    }

    if (arista.kind === 'generalization') {
      const elemento = crear(ctx, 'UML:Generalization')
      // `subtype` es la subclase: nuestro origen. `supertype` la superclase: el destino.
      elemento.setAttribute('subtype', idEa(arista.source))
      elemento.setAttribute('supertype', idEa(arista.target))
      elemento.setAttribute('xmi.id', idEa(arista.id))
      elemento.setAttribute('visibility', 'public')
      ponEtiquetas(ctx, elemento, comunes)
      dentroDelPaquete.appendChild(elemento)
      continue
    }

    if (arista.kind === 'realization') {
      const elemento = crear(ctx, 'UML:Abstraction')
      elemento.setAttribute('client', idEa(arista.source))
      elemento.setAttribute('supplier', idEa(arista.target))
      elemento.setAttribute('xmi.id', idEa(arista.id))
      elemento.setAttribute('visibility', 'public')
      ponEtiquetas(ctx, elemento, { ...comunes, stereotype: 'realize' })
      dentroDelPaquete.appendChild(elemento)
      continue
    }

    const elemento = crear(ctx, 'UML:Association')
    if (arista.name !== null && arista.name !== '') elemento.setAttribute('name', arista.name)
    elemento.setAttribute('xmi.id', idEa(arista.id))
    elemento.setAttribute('visibility', 'public')
    elemento.setAttribute('isRoot', 'false')
    elemento.setAttribute('isLeaf', 'false')
    elemento.setAttribute('isAbstract', 'false')

    const clase = claseDeArista.get(arista.id)

    ponEtiquetas(ctx, elemento, {
      ...comunes,
      subtype: clase === undefined ? undefined : 'Class',
      associationclass: clase === undefined ? undefined : idEa(clase.id),
      lb: arista.ends.source.multiplicity ?? undefined,
      rb: arista.ends.target.multiplicity ?? undefined,
      mt: arista.name ?? undefined,
    })

    const conexion = crear(ctx, 'UML:Association.connection')

    for (const lado of ['source', 'target'] as const) {
      const fin = arista.ends[lado]
      const extremo = crear(ctx, 'UML:AssociationEnd')

      if (fin.role !== null && fin.role !== '') extremo.setAttribute('name', fin.role)
      extremo.setAttribute('visibility', 'public')
      if (fin.multiplicity !== null) extremo.setAttribute('multiplicity', fin.multiplicity)

      /**
       * Aquí está la inversión. UML 1.3 marca el extremo del TODO, y nuestro todo es el
       * origen, así que la marca va en `source`. En UML 2.x iría en el otro.
       */
      extremo.setAttribute(
        'aggregation',
        lado === 'source' ? (AGREGACION[arista.kind] ?? 'none') : 'none',
      )
      extremo.setAttribute('isOrdered', String(fin.isOrdered))
      extremo.setAttribute('isNavigable', String(fin.navigable !== false))
      extremo.setAttribute('type', idEa(lado === 'source' ? arista.source : arista.target))

      ponEtiquetas(ctx, extremo, {
        [lado === 'source' ? 'sourcestyle' : 'deststyle']:
          'Derived=0;Union=0;AllowDuplicates=0;Owned=0;Navigable=Unspecified;',
        ea_end: lado,
      })

      conexion.appendChild(extremo)
    }

    elemento.appendChild(conexion)
    dentroDelPaquete.appendChild(elemento)
  }

  // Los tipos, al final del modelo: primero el "sin tipo" y luego los que se usaron.
  const sinTipo = crear(ctx, 'UML:DataType')
  sinTipo.setAttribute('xmi.id', SIN_TIPO)
  sinTipo.setAttribute('visibility', 'private')
  sinTipo.setAttribute('isRoot', 'false')
  sinTipo.setAttribute('isLeaf', 'false')
  sinTipo.setAttribute('isAbstract', 'false')
  contenidoModelo.appendChild(sinTipo)

  for (const [nombre, id] of tipos) {
    const tipo = crear(ctx, 'UML:DataType')
    tipo.setAttribute('name', nombre)
    tipo.setAttribute('xmi.id', id)
    tipo.setAttribute('visibility', 'public')
    tipo.setAttribute('isRoot', 'false')
    tipo.setAttribute('isLeaf', 'false')
    tipo.setAttribute('isAbstract', 'false')
    contenidoModelo.appendChild(tipo)
  }

  // --- el diagrama, que es donde viven las posiciones ---

  for (const vista of documento.diagrams) {
    const diagrama = crear(ctx, 'UML:Diagram')
    diagrama.setAttribute('name', vista.name)
    diagrama.setAttribute('xmi.id', idEa(vista.id))
    diagrama.setAttribute('diagramType', 'ClassDiagram')
    diagrama.setAttribute('owner', idPaq)
    diagrama.setAttribute('toolName', HERRAMIENTA)

    const creado = documento.meta.createdAt.slice(0, 19).replace('T', ' ')
    const modificado = documento.meta.updatedAt.slice(0, 19).replace('T', ' ')

    ponEtiquetas(ctx, diagrama, {
      ...nuestrasEtiquetas(vista.id),
      version: '1.0',
      author: 'Diagramador UML',
      created_date: creado,
      modified_date: modificado,
      package: idPaq,
      type: 'Logical',
      swimlanes:
        'locked=false;orientation=0;width=0;inbar=false;names=false;color=-1;bold=false;' +
        'fcol=0;tcol=-1;ofCol=-1;ufCol=-1;hl=0;ufh=0;hh=0;cls=0;bw=0;hli=0;',
      matrixitems:
        'locked=false;matrixactive=false;swimlanesactive=true;kanbanactive=false;width=1;clrLine=0;',
      ea_localid: '1',
      EAStyle:
        'ShowPrivate=1;ShowProtected=1;ShowPublic=1;HideRelationships=0;Locked=0;Border=1;' +
        'HighlightForeign=1;PackageContents=1;SequenceNotes=0;ScalePrintImage=0;ShowDetails=0;' +
        'Orientation=P;Zoom=100;ShowIcons=1;HideProps=0;PaperSize=1;HideParents=0;UseAlias=0;' +
        'HideAtts=0;HideOps=0;HideStereo=0;HideElemStereo=0;ConnectorNotation=UML 2.1;' +
        'ExplicitNavigability=0;ShowShape=1;SPT=1;',
      styleex:
        'ExcludeRTF=0;DocAll=0;HideQuals=0;AttPkg=1;ShowTests=0;ShowMaint=0;SuppressFOC=1;' +
        'MatrixActive=0;SwimlanesActive=1;KanbanActive=0;MatrixLineWidth=1;MatrixLineClr=0;' +
        'MatrixLocked=0;TConnectorNotation=UML 2.1;TExplicitNavigability=0;SPT=1;ShowNotes=0;' +
        'VisibleAttributeDetail=0;ShowOpRetType=1;SuppressBrackets=0;SuppConnectorLabels=0;' +
        'PrintPageHeadFoot=0;ShowAsList=0;',
    })

    const elementos = crear(ctx, 'UML:Diagram.element')
    let orden = 1

    for (const nodo of Object.values(documento.nodes)) {
      if (nodo.diagramId !== vista.id) continue

      const izquierda = Math.round(nodo.position.x)
      const arriba = Math.round(nodo.position.y)
      const derecha = izquierda + Math.round(nodo.size.width)
      const abajo = arriba + Math.round(nodo.size.height ?? ALTO_NOMINAL)

      const elemento = crear(ctx, 'UML:DiagramElement')
      elemento.setAttribute('geometry', `Left=${izquierda};Top=${arriba};Right=${derecha};Bottom=${abajo};`)
      elemento.setAttribute('subject', idEa(nodo.id))
      elemento.setAttribute('seqno', String(orden))
      elemento.setAttribute(
        'style',
        `DUID=${duid(nodo.id)};NSL=0;BCol=-1;BFol=-1;LCol=-1;LWth=-1;fontsz=0;bold=0;black=0;italic=0;ul=0;charset=0;pitch=0;`,
      )


      elementos.appendChild(elemento)
      orden += 1
    }

    /**
     * Las líneas también son elementos del diagrama, y EA las enlaza con las cajas por el
     * DUID: `SOID` es la de origen y `EOID` la de destino. Sin esto el diagrama trae las
     * cajas pero no las relaciones entre ellas.
     */
    for (const arista of Object.values(documento.edges)) {
      if (arista.diagramId !== vista.id) continue

      const elemento = crear(ctx, 'UML:DiagramElement')
      elemento.setAttribute('geometry', 'EDGE=2;$LLB=;LLT=;LMT=;LMB=;LRT=;LRB=;IRHS=;ILHS=;Path=;')
      elemento.setAttribute('subject', idEa(arista.id))
      elemento.setAttribute(
        'style',
        `Mode=3;EOID=${duid(arista.target)};SOID=${duid(arista.source)};Color=-1;LWidth=0;Hidden=0;`,
      )

      elementos.appendChild(elemento)
    }

    diagrama.appendChild(elementos)
    contenido.appendChild(diagrama)
  }

  raiz.appendChild(crear(ctx, 'XMI.difference'))

  const extensiones = crear(ctx, 'XMI.extensions')
  extensiones.setAttribute('xmi.extender', HERRAMIENTA)
  extensiones.appendChild(crear(ctx, 'EAModel.paramSub'))
  raiz.appendChild(extensiones)

  const texto = new XMLSerializer().serializeToString(xml)
  return `<?xml version="1.0" encoding="UTF-8"?>\n${texto}\n`
}
