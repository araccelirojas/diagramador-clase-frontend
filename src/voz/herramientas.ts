import {
  addEdge,
  addEdgeWithClass,
  addMember,
  addNode,
  removeEdges,
  removeMember,
  removeNodes,
  renameNode,
  setEdgeEnd,
  setEdgeName,
  setEdgeRouting,
  setEdgeWaypoints,
  setNodePosition,
  updateMember,
} from '@/state/commands'
import { useDiagramStore } from '@/state/useDiagramStore'
import {
  createEdge,
  createNode,
  createOperation,
  createParameter,
  createProperty,
} from '@/uml/model/factories'
import { compartmentIdsOf, getClassifier, RELATIONS } from '@/uml/registry'
import type { UmlNode, Visibility } from '@/uml/model/types'
import { detallarNodo, resumirDiagrama } from '@/voz/resumen'
import { resaltar } from '@/voz/resaltado'
import { resolverNodo, resolverPorNombre, resolverRelacion } from '@/voz/resolverNombre'
import { ubicarJuntoA, ubicarNuevo, type Direccion } from '@/voz/ubicacion'
import { calcularDisposicion } from '@/voz/ordenar'

/**
 * Lo que el agente puede hacer.
 *
 * Todas las herramientas pasan por `dispatch`, la misma puerta que usa la interfaz cuando
 * editás con el ratón. Eso no es una preferencia de estilo: es lo que hace que el agente
 * herede el undo/redo, la validación del documento, el refresco del lienzo y la difusión a
 * los demás colaboradores sin escribir nada de eso otra vez.
 *
 * Dos reglas que las atraviesan todas:
 *
 * - Se habla por NOMBRE, nunca por id. El id es cosa nuestra; el usuario dice "PELÍCULA".
 * - Ante un nombre ambiguo NO se elige: se devuelven los candidatos y el agente pregunta.
 *   Acertar nueve de diez y renombrar la clase equivocada la décima es peor que preguntar.
 */

export type Resultado = { ok: true; mensaje: string } | { ok: false; error: string }

const bien = (mensaje: string): Resultado => ({ ok: true, mensaje })
const mal = (error: string): Resultado => ({ ok: false, error })

const VISIBILIDADES: Record<string, Visibility> = {
  publico: '+',
  privado: '-',
  protegido: '#',
  paquete: '~',
}

const doc = () => useDiagramStore.getState().doc
const despachar = useDiagramStore.getState().dispatch

/** Traduce el resultado de resolver un nombre a un error que el agente sepa contar. */
function exigirNodo(nombre: string): UmlNode | Resultado {
  const resultado = resolverNodo(doc(), nombre)

  if (resultado.tipo === 'uno') return resultado.valor
  if (resultado.tipo === 'ninguno') {
    return mal(`No hay ninguna clase que se llame "${nombre}" en el diagrama.`)
  }

  return mal(
    `Hay varias que podrían ser: ${resultado.candidatos.join(', ')}. Preguntá cuál de ellas.`,
  )
}

const esError = (valor: unknown): valor is Resultado =>
  typeof valor === 'object' && valor !== null && 'ok' in valor

// --- lectura ---

const resumen = (): Resultado => bien(resumirDiagrama(doc()))

function detalle(args: { clase: string }): Resultado {
  const nodo = exigirNodo(args.clase)
  if (esError(nodo)) return nodo

  return bien(detallarNodo(doc(), nodo))
}

// --- clases ---

function crearClase(args: {
  nombre: string
  tipo?: string
  cerca_de?: string
  direccion?: Direccion
}): Resultado {
  const nombre = args.nombre.trim()
  if (nombre === '') return mal('Falta el nombre de la clase.')

  const yaEsta = Object.values(doc().nodes).find(
    (nodo) => nodo.name.toLowerCase() === nombre.toLowerCase(),
  )
  if (yaEsta !== undefined) return mal(`Ya existe una clase llamada "${yaEsta.name}".`)

  const kind = args.tipo === 'interfaz' ? 'interface' : 'class'
  const spec = getClassifier(kind)

  let referencia: UmlNode | null = null

  if (args.cerca_de !== undefined && args.cerca_de !== '') {
    const encontrada = exigirNodo(args.cerca_de)
    if (esError(encontrada)) return encontrada
    referencia = encontrada
  }

  const nodo = createNode({
    kind,
    name: nombre,
    diagramId: useDiagramStore.getState().activeDiagramId,
    position: ubicarNuevo(doc(), referencia, args.direccion ?? 'cerca'),
    compartmentIds: compartmentIdsOf(spec),
    keywords: kind === 'interface' ? (spec.defaultKeywords ?? []) : [],
  })

  despachar(addNode({ node: nodo }))
  resaltar(nodo.id)

  return bien(`Creada la clase ${nombre}.`)
}

function renombrar(args: { actual: string; nuevo: string }): Resultado {
  const nodo = exigirNodo(args.actual)
  if (esError(nodo)) return nodo

  const nuevo = args.nuevo.trim()
  if (nuevo === '') return mal('Falta el nombre nuevo.')

  const chocan = Object.values(doc().nodes).find(
    (otro) => otro.id !== nodo.id && otro.name.toLowerCase() === nuevo.toLowerCase(),
  )
  if (chocan !== undefined) return mal(`Ya hay otra clase llamada "${chocan.name}".`)

  despachar(renameNode({ id: nodo.id, name: nuevo }))
  resaltar(nodo.id)

  return bien(`${nodo.name} ahora se llama ${nuevo}.`)
}

function eliminar(args: { nombre: string; confirmado?: boolean }): Resultado {
  const nodo = exigirNodo(args.nombre)
  if (esError(nodo)) return nodo

  const suyas = Object.values(doc().edges).filter(
    (arista) => arista.source === nodo.id || arista.target === nodo.id,
  )

  /**
   * La confirmación se exige AQUÍ y no solo en el prompt. Una instrucción de sistema se
   * puede ignorar; esto no. Borrar una clase se lleva sus relaciones por delante.
   */
  if (args.confirmado !== true) {
    const aviso =
      suyas.length === 0
        ? `Se va a borrar ${nodo.name}.`
        : `Se va a borrar ${nodo.name} y con ella ${suyas.length} ${
            suyas.length === 1 ? 'relación' : 'relaciones'
          }.`

    return mal(`${aviso} Pedí confirmación y volvé a llamar con confirmado = true.`)
  }

  despachar(removeNodes({ ids: [nodo.id] }))

  return bien(
    `Borrada ${nodo.name}${suyas.length > 0 ? ` y sus ${suyas.length} relaciones` : ''}.`,
  )
}

function mover(args: { nombre: string; referencia: string; direccion: Direccion }): Resultado {
  const nodo = exigirNodo(args.nombre)
  if (esError(nodo)) return nodo

  const referencia = exigirNodo(args.referencia)
  if (esError(referencia)) return referencia

  if (nodo.id === referencia.id) return mal('No se puede mover una clase respecto a sí misma.')

  despachar(
    setNodePosition({
      id: nodo.id,
      position: ubicarJuntoA(doc(), nodo, referencia, args.direccion),
    }),
  )
  resaltar(nodo.id)

  return bien(`${nodo.name} movida ${args.direccion} de ${referencia.name}.`)
}

// --- atributos y operaciones ---

function agregarAtributo(args: {
  clase: string
  nombre: string
  tipo?: string
  visibilidad?: string
  multiplicidad?: string
  es_clave?: boolean
}): Resultado {
  const nodo = exigirNodo(args.clase)
  if (esError(nodo)) return nodo

  const nombre = args.nombre.trim()
  if (nombre === '') return mal('Falta el nombre del atributo.')

  const repetido = (nodo.compartments.attributes ?? []).find(
    (miembro) => miembro.name.toLowerCase() === nombre.toLowerCase(),
  )
  if (repetido !== undefined) {
    return mal(`${nodo.name} ya tiene un atributo llamado "${repetido.name}".`)
  }

  const propiedad = createProperty({
    name: nombre,
    type: args.tipo ?? null,
    visibility: VISIBILIDADES[args.visibilidad ?? 'privado'] ?? '-',
    multiplicity: args.multiplicidad ?? null,
    isId: args.es_clave === true,
  })

  despachar(
    addMember({ nodeId: nodo.id, compartmentId: 'attributes', member: propiedad }),
  )
  resaltar(nodo.id)

  return bien(`Agregado ${nombre} a ${nodo.name}.`)
}

/** El atributo dentro de su clase, resuelto también por nombre. */
function buscarAtributo(nodo: UmlNode, nombre: string) {
  const atributos = (nodo.compartments.attributes ?? []).filter(
    (miembro) => miembro.kind === 'property',
  )

  return resolverPorNombre(nombre, atributos, (miembro) => miembro.name)
}

function modificarAtributo(args: {
  clase: string
  nombre: string
  nuevo_nombre?: string
  tipo?: string
  visibilidad?: string
  multiplicidad?: string
  es_clave?: boolean
}): Resultado {
  const nodo = exigirNodo(args.clase)
  if (esError(nodo)) return nodo

  const encontrado = buscarAtributo(nodo, args.nombre)

  if (encontrado.tipo === 'ninguno') {
    return mal(`${nodo.name} no tiene ningún atributo llamado "${args.nombre}".`)
  }
  if (encontrado.tipo === 'varios') {
    return mal(`Podría ser ${encontrado.candidatos.join(' o ')}. Preguntá cuál.`)
  }

  /**
   * El `kind` no es decorativo: `updateMember` compara el del parche con el del miembro y,
   * si no coinciden, no hace nada y no avisa. Sin esta línea la herramienta decía "listo" y
   * el atributo se quedaba igual.
   */
  const patch: Record<string, unknown> = { kind: 'property' }
  if (args.nuevo_nombre !== undefined) patch.name = args.nuevo_nombre
  if (args.tipo !== undefined) patch.type = args.tipo
  if (args.visibilidad !== undefined) patch.visibility = VISIBILIDADES[args.visibilidad] ?? '-'
  if (args.multiplicidad !== undefined) patch.multiplicity = args.multiplicidad
  if (args.es_clave !== undefined) patch.isId = args.es_clave

  if (Object.keys(patch).length === 1) return mal('No se dijo qué cambiar del atributo.')

  despachar(
    updateMember({
      nodeId: nodo.id,
      compartmentId: 'attributes',
      memberId: encontrado.valor.id,
      patch: patch as never,
    }),
  )
  resaltar(nodo.id)

  return bien(`Actualizado ${encontrado.valor.name} en ${nodo.name}.`)
}

function quitarAtributo(args: { clase: string; nombre: string }): Resultado {
  const nodo = exigirNodo(args.clase)
  if (esError(nodo)) return nodo

  const encontrado = buscarAtributo(nodo, args.nombre)

  if (encontrado.tipo === 'ninguno') {
    return mal(`${nodo.name} no tiene ningún atributo llamado "${args.nombre}".`)
  }
  if (encontrado.tipo === 'varios') {
    return mal(`Podría ser ${encontrado.candidatos.join(' o ')}. Preguntá cuál.`)
  }

  despachar(
    removeMember({ nodeId: nodo.id, compartmentId: 'attributes', memberId: encontrado.valor.id }),
  )
  resaltar(nodo.id)

  return bien(`Quitado ${encontrado.valor.name} de ${nodo.name}.`)
}

function agregarOperacion(args: {
  clase: string
  nombre: string
  tipo_retorno?: string
  visibilidad?: string
  parametros?: string[]
}): Resultado {
  const nodo = exigirNodo(args.clase)
  if (esError(nodo)) return nodo

  const nombre = args.nombre.trim()
  if (nombre === '') return mal('Falta el nombre de la operación.')

  const operacion = createOperation({
    name: nombre,
    returnType: args.tipo_retorno ?? null,
    visibility: VISIBILIDADES[args.visibilidad ?? 'publico'] ?? '+',
    parameters: (args.parametros ?? []).map((texto) => {
      // "curso: Curso" o solo "curso": se acepta lo que salga del dictado.
      const [suNombre, suTipo] = texto.split(':').map((parte) => parte.trim())
      return createParameter({ name: suNombre ?? 'arg', type: suTipo ?? null })
    }),
  })

  despachar(addMember({ nodeId: nodo.id, compartmentId: 'operations', member: operacion }))
  resaltar(nodo.id)

  return bien(`Agregada la operación ${nombre} a ${nodo.name}.`)
}

function quitarOperacion(args: { clase: string; nombre: string }): Resultado {
  const nodo = exigirNodo(args.clase)
  if (esError(nodo)) return nodo

  const operaciones = (nodo.compartments.operations ?? []).filter(
    (miembro) => miembro.kind === 'operation',
  )
  const encontrado = resolverPorNombre(args.nombre, operaciones, (miembro) => miembro.name)

  if (encontrado.tipo === 'ninguno') {
    return mal(`${nodo.name} no tiene ninguna operación llamada "${args.nombre}".`)
  }
  if (encontrado.tipo === 'varios') {
    return mal(`Podría ser ${encontrado.candidatos.join(' o ')}. Preguntá cuál.`)
  }

  despachar(
    removeMember({ nodeId: nodo.id, compartmentId: 'operations', memberId: encontrado.valor.id }),
  )
  resaltar(nodo.id)

  return bien(`Quitada ${encontrado.valor.name} de ${nodo.name}.`)
}

// --- relaciones ---

const TIPOS_RELACION: Record<string, string> = {
  asociacion: 'association',
  'asociacion dirigida': 'directed-association',
  agregacion: 'aggregation',
  composicion: 'composition',
  generalizacion: 'generalization',
  herencia: 'generalization',
  realizacion: 'realization',
  'clase de asociacion': 'association-class',
}

/** Acepta tanto la palabra en español como el kind interno. */
function kindDeRelacion(texto: string): string | null {
  const limpio = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

  return TIPOS_RELACION[limpio] ?? (limpio in RELATIONS ? limpio : null)
}

function crearRelacion(args: {
  origen: string
  destino: string
  tipo: string
  multiplicidad_origen?: string
  multiplicidad_destino?: string
  nombre?: string
  rol_origen?: string
  rol_destino?: string
  clase_asociacion?: string
}): Resultado {
  const origen = exigirNodo(args.origen)
  if (esError(origen)) return origen

  const destino = exigirNodo(args.destino)
  if (esError(destino)) return destino

  const kind = kindDeRelacion(args.tipo)
  if (kind === null) return mal(`No conozco un tipo de relación llamado "${args.tipo}".`)

  if (origen.id === destino.id && (kind === 'generalization' || kind === 'realization')) {
    return mal('Una clase no puede heredar de sí misma.')
  }

  const ends = {
    source: {
      multiplicity: args.multiplicidad_origen ?? null,
      role: args.rol_origen ?? null,
    },
    target: {
      multiplicity: args.multiplicidad_destino ?? null,
      role: args.rol_destino ?? null,
    },
  }

  const arista = createEdge({
    kind,
    diagramId: useDiagramStore.getState().activeDiagramId,
    source: origen.id,
    target: destino.id,
    name: args.nombre ?? null,
    ends,
  })

  // La clase de asociación nace junto con su relación: una no existe sin la otra (§5.4.6).
  if (kind === 'association-class') {
    const spec = getClassifier('association-class')
    const nombreClase = args.clase_asociacion ?? `${origen.name}${destino.name}`

    const nodo = createNode({
      kind: 'association-class',
      name: nombreClase,
      diagramId: useDiagramStore.getState().activeDiagramId,
      position: ubicarNuevo(doc(), origen, 'abajo'),
      compartmentIds: compartmentIdsOf(spec),
      associationId: arista.id,
    })

    despachar(addEdgeWithClass({ edge: arista, node: nodo }))
    resaltar(arista.id, nodo.id)

    return bien(`Creada la relación entre ${origen.name} y ${destino.name}, con la clase ${nombreClase}.`)
  }

  despachar(addEdge({ edge: arista }))
  resaltar(arista.id)

  return bien(`Creada la ${args.tipo} de ${origen.name} a ${destino.name}.`)
}

function modificarRelacion(args: {
  origen: string
  destino: string
  tipo?: string
  multiplicidad_origen?: string
  multiplicidad_destino?: string
  nombre?: string
  rol_origen?: string
  rol_destino?: string
}): Resultado {
  const origen = exigirNodo(args.origen)
  if (esError(origen)) return origen

  const destino = exigirNodo(args.destino)
  if (esError(destino)) return destino

  const kind = args.tipo === undefined ? undefined : (kindDeRelacion(args.tipo) ?? undefined)
  const encontrada = resolverRelacion(doc(), origen, destino, kind)

  if (encontrada.tipo === 'ninguno') {
    return mal(`No hay ninguna relación entre ${origen.name} y ${destino.name}.`)
  }
  if (encontrada.tipo === 'varios') {
    return mal(`Hay varias: ${encontrada.candidatos.join('; ')}. Preguntá cuál.`)
  }

  const arista = encontrada.valor

  // El origen de la relación puede no ser el que el usuario nombró primero.
  const ladoDe = (nombrado: UmlNode): 'source' | 'target' =>
    arista.source === nombrado.id ? 'source' : 'target'

  let cambios = 0

  if (args.multiplicidad_origen !== undefined) {
    despachar(
      setEdgeEnd({
        id: arista.id,
        side: ladoDe(origen),
        patch: { multiplicity: args.multiplicidad_origen },
      }),
    )
    cambios += 1
  }

  if (args.multiplicidad_destino !== undefined) {
    despachar(
      setEdgeEnd({
        id: arista.id,
        side: ladoDe(destino),
        patch: { multiplicity: args.multiplicidad_destino },
      }),
    )
    cambios += 1
  }

  if (args.rol_origen !== undefined) {
    despachar(setEdgeEnd({ id: arista.id, side: ladoDe(origen), patch: { role: args.rol_origen } }))
    cambios += 1
  }

  if (args.rol_destino !== undefined) {
    despachar(
      setEdgeEnd({ id: arista.id, side: ladoDe(destino), patch: { role: args.rol_destino } }),
    )
    cambios += 1
  }

  if (args.nombre !== undefined) {
    despachar(setEdgeName({ id: arista.id, name: args.nombre }))
    cambios += 1
  }

  if (cambios === 0) return mal('No se dijo qué cambiar de la relación.')

  resaltar(arista.id)
  return bien(`Actualizada la relación entre ${origen.name} y ${destino.name}.`)
}

function eliminarRelacion(args: {
  origen: string
  destino: string
  tipo?: string
  confirmado?: boolean
}): Resultado {
  const origen = exigirNodo(args.origen)
  if (esError(origen)) return origen

  const destino = exigirNodo(args.destino)
  if (esError(destino)) return destino

  const kind = args.tipo === undefined ? undefined : (kindDeRelacion(args.tipo) ?? undefined)
  const encontrada = resolverRelacion(doc(), origen, destino, kind)

  if (encontrada.tipo === 'ninguno') {
    return mal(`No hay ninguna relación entre ${origen.name} y ${destino.name}.`)
  }
  if (encontrada.tipo === 'varios') {
    return mal(`Hay varias: ${encontrada.candidatos.join('; ')}. Preguntá cuál.`)
  }

  if (args.confirmado !== true) {
    return mal(
      `Se va a borrar la relación entre ${origen.name} y ${destino.name}. ` +
        'Pedí confirmación y volvé a llamar con confirmado = true.',
    )
  }

  despachar(removeEdges({ ids: [encontrada.valor.id] }))

  return bien(`Borrada la relación entre ${origen.name} y ${destino.name}.`)
}

const TRAZADOS: Record<string, 'straight' | 'orthogonal' | 'bezier'> = {
  recta: 'straight',
  recto: 'straight',
  ortogonal: 'orthogonal',
  angulos: 'orthogonal',
  curva: 'bezier',
  curvo: 'bezier',
}

function cambiarTrazado(args: { origen: string; destino: string; trazado: string }): Resultado {
  const origen = exigirNodo(args.origen)
  if (esError(origen)) return origen

  const destino = exigirNodo(args.destino)
  if (esError(destino)) return destino

  const routing = TRAZADOS[
    args.trazado
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
  ]

  if (routing === undefined) {
    return mal(`No conozco un trazado llamado "${args.trazado}". Hay recta, ortogonal y curva.`)
  }

  const encontrada = resolverRelacion(doc(), origen, destino)

  if (encontrada.tipo === 'ninguno') {
    return mal(`No hay ninguna relación entre ${origen.name} y ${destino.name}.`)
  }
  if (encontrada.tipo === 'varios') {
    return mal(`Hay varias: ${encontrada.candidatos.join('; ')}. Preguntá cuál.`)
  }

  despachar(setEdgeRouting({ id: encontrada.valor.id, routing }))
  resaltar(encontrada.valor.id)

  return bien(`La relación entre ${origen.name} y ${destino.name} ahora va en ${args.trazado}.`)
}

function enderezarRelacion(args: { origen: string; destino: string }): Resultado {
  const origen = exigirNodo(args.origen)
  if (esError(origen)) return origen

  const destino = exigirNodo(args.destino)
  if (esError(destino)) return destino

  const encontrada = resolverRelacion(doc(), origen, destino)

  if (encontrada.tipo === 'ninguno') {
    return mal(`No hay ninguna relación entre ${origen.name} y ${destino.name}.`)
  }
  if (encontrada.tipo === 'varios') {
    return mal(`Hay varias: ${encontrada.candidatos.join('; ')}. Preguntá cuál.`)
  }

  if (encontrada.valor.waypoints.length === 0) {
    return mal('Esa relación ya está derecha, no tiene puntos puestos a mano.')
  }

  despachar(setEdgeWaypoints({ id: encontrada.valor.id, waypoints: [] }))
  resaltar(encontrada.valor.id)

  return bien(`Enderezada la relación entre ${origen.name} y ${destino.name}.`)
}

/**
 * Recolocar el diagrama entero.
 *
 * El cálculo lo hace un algoritmo, no el agente: una disposición sin solapamientos no se
 * saca de cabeza leyendo una lista de coordenadas. El agente decide CUÁNDO hace falta y lo
 * explica; el dónde va cada caja se calcula.
 *
 * Todos los movimientos van en un solo comando para que el usuario lo deshaga de una vez y
 * no clase por clase.
 */
function ordenarDiagrama(): Resultado {
  const posiciones = calcularDisposicion(doc())

  if (posiciones.size === 0) return mal('No hay clases que ordenar.')

  const actuales = doc().nodes
  const movidas = [...posiciones].filter(([id, posicion]) => {
    const nodo = actuales[id]
    return nodo !== undefined && (nodo.position.x !== posicion.x || nodo.position.y !== posicion.y)
  })

  if (movidas.length === 0) return bien('El diagrama ya estaba ordenado, no hizo falta mover nada.')

  for (const [id, posicion] of movidas) despachar(setNodePosition({ id, position: posicion }))

  resaltar(...movidas.map(([id]) => id))

  return bien(
    `Reordenado el diagrama: ${movidas.length} ${movidas.length === 1 ? 'clase movida' : 'clases movidas'}, ` +
      'con las superclases arriba y sin cajas encimadas.',
  )
}

function deshacer(): Resultado {
  const estado = useDiagramStore.getState()

  if (estado.history.past.length === 0) return mal('No hay nada que deshacer.')

  estado.undo()
  return bien('Deshecho el último cambio.')
}

// --- el registro que ve el agente ---

const texto = (description: string) => ({ type: 'string' as const, description })

export const HERRAMIENTAS = [
  {
    type: 'function' as const,
    name: 'resumen_diagrama',
    description:
      'Devuelve el diagrama completo: clases con sus atributos y operaciones, y todas las ' +
      'relaciones. Úsalo para orientarte antes de cambiar algo o si te preguntan qué hay.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    type: 'function' as const,
    name: 'detalle_clase',
    description: 'Todo sobre UNA clase: sus atributos, sus operaciones y sus relaciones.',
    parameters: {
      type: 'object',
      properties: { clase: texto('Nombre de la clase, como lo dijo el usuario.') },
      required: ['clase'],
    },
  },
  {
    type: 'function' as const,
    name: 'crear_clase',
    description: 'Crea UNA clase nueva en el diagrama actual.',
    parameters: {
      type: 'object',
      properties: {
        nombre: texto('Nombre de la clase nueva.'),
        tipo: { type: 'string', enum: ['clase', 'interfaz'], description: 'Por defecto clase.' },
        cerca_de: texto('Clase junto a la cual colocarla, si el usuario lo dijo.'),
        direccion: {
          type: 'string',
          enum: ['derecha', 'izquierda', 'arriba', 'abajo', 'cerca'],
          description: 'Dónde ponerla respecto de cerca_de.',
        },
      },
      required: ['nombre'],
    },
  },
  {
    type: 'function' as const,
    name: 'renombrar_clase',
    description: 'Le cambia el nombre a una clase.',
    parameters: {
      type: 'object',
      properties: { actual: texto('Cómo se llama ahora.'), nuevo: texto('Cómo se va a llamar.') },
      required: ['actual', 'nuevo'],
    },
  },
  {
    type: 'function' as const,
    name: 'eliminar_clase',
    description:
      'Borra una clase y todas sus relaciones. Preguntá al usuario ANTES y solo entonces ' +
      'llamá con confirmado = true.',
    parameters: {
      type: 'object',
      properties: {
        nombre: texto('Clase a borrar.'),
        confirmado: { type: 'boolean', description: 'true solo si el usuario ya dijo que sí.' },
      },
      required: ['nombre'],
    },
  },
  {
    type: 'function' as const,
    name: 'mover_clase',
    description: 'Mueve una clase junto a otra. Para "pon X a la derecha de Y".',
    parameters: {
      type: 'object',
      properties: {
        nombre: texto('Clase que se mueve.'),
        referencia: texto('Clase que sirve de referencia.'),
        direccion: {
          type: 'string',
          enum: ['derecha', 'izquierda', 'arriba', 'abajo', 'cerca'],
        },
      },
      required: ['nombre', 'referencia', 'direccion'],
    },
  },
  {
    type: 'function' as const,
    name: 'agregar_atributo',
    description: 'Agrega un atributo a una clase.',
    parameters: {
      type: 'object',
      properties: {
        clase: texto('Clase que recibe el atributo.'),
        nombre: texto('Nombre del atributo.'),
        tipo: texto('Tipo, tal como lo dijo el usuario: String, int, Date...'),
        visibilidad: { type: 'string', enum: ['publico', 'privado', 'protegido', 'paquete'] },
        multiplicidad: texto('1, 0..1, 1..*, 0..* — solo si el usuario la dijo.'),
        es_clave: { type: 'boolean', description: 'true si es la clave primaria.' },
      },
      required: ['clase', 'nombre'],
    },
  },
  {
    type: 'function' as const,
    name: 'modificar_atributo',
    description: 'Cambia el nombre, el tipo, la visibilidad o la multiplicidad de un atributo.',
    parameters: {
      type: 'object',
      properties: {
        clase: texto('Clase a la que pertenece.'),
        nombre: texto('Atributo a cambiar.'),
        nuevo_nombre: texto('Nombre nuevo, si se le cambia.'),
        tipo: texto('Tipo nuevo.'),
        visibilidad: { type: 'string', enum: ['publico', 'privado', 'protegido', 'paquete'] },
        multiplicidad: texto('Multiplicidad nueva.'),
        es_clave: { type: 'boolean' },
      },
      required: ['clase', 'nombre'],
    },
  },
  {
    type: 'function' as const,
    name: 'quitar_atributo',
    description: 'Quita un atributo de una clase.',
    parameters: {
      type: 'object',
      properties: { clase: texto('Clase.'), nombre: texto('Atributo a quitar.') },
      required: ['clase', 'nombre'],
    },
  },
  {
    type: 'function' as const,
    name: 'agregar_operacion',
    description: 'Agrega una operación (método) a una clase.',
    parameters: {
      type: 'object',
      properties: {
        clase: texto('Clase.'),
        nombre: texto('Nombre de la operación.'),
        tipo_retorno: texto('Lo que devuelve, si se dijo.'),
        visibilidad: { type: 'string', enum: ['publico', 'privado', 'protegido', 'paquete'] },
        parametros: {
          type: 'array',
          items: { type: 'string' },
          description: 'Parámetros, como "curso: Curso" o solo "curso".',
        },
      },
      required: ['clase', 'nombre'],
    },
  },
  {
    type: 'function' as const,
    name: 'quitar_operacion',
    description: 'Quita una operación de una clase.',
    parameters: {
      type: 'object',
      properties: { clase: texto('Clase.'), nombre: texto('Operación a quitar.') },
      required: ['clase', 'nombre'],
    },
  },
  {
    type: 'function' as const,
    name: 'crear_relacion',
    description:
      'Conecta dos clases. En generalización el origen es la SUBCLASE; en composición y ' +
      'agregación el origen es el TODO, el del rombo.',
    parameters: {
      type: 'object',
      properties: {
        origen: texto('Clase de origen.'),
        destino: texto('Clase de destino.'),
        tipo: {
          type: 'string',
          enum: [
            'asociacion',
            'asociacion dirigida',
            'agregacion',
            'composicion',
            'generalizacion',
            'realizacion',
            'clase de asociacion',
          ],
        },
        multiplicidad_origen: texto('1, 0..1, 1..*, 0..*'),
        multiplicidad_destino: texto('1, 0..1, 1..*, 0..*'),
        nombre: texto('Nombre de la relación, si tiene.'),
        rol_origen: texto('Rol del extremo de origen.'),
        rol_destino: texto('Rol del extremo de destino.'),
        clase_asociacion: texto('Nombre de la clase colgante, solo para clase de asociación.'),
      },
      required: ['origen', 'destino', 'tipo'],
    },
  },
  {
    type: 'function' as const,
    name: 'modificar_relacion',
    description: 'Cambia multiplicidades, roles o el nombre de una relación que ya existe.',
    parameters: {
      type: 'object',
      properties: {
        origen: texto('Una de las dos clases.'),
        destino: texto('La otra.'),
        tipo: texto('Tipo de relación, si hay varias entre esas dos clases.'),
        multiplicidad_origen: texto('Nueva multiplicidad del lado de origen.'),
        multiplicidad_destino: texto('Nueva multiplicidad del lado de destino.'),
        nombre: texto('Nombre nuevo de la relación.'),
        rol_origen: texto('Rol nuevo del lado de origen.'),
        rol_destino: texto('Rol nuevo del lado de destino.'),
      },
      required: ['origen', 'destino'],
    },
  },
  {
    type: 'function' as const,
    name: 'eliminar_relacion',
    description: 'Borra una relación. Preguntá ANTES y solo entonces llamá con confirmado = true.',
    parameters: {
      type: 'object',
      properties: {
        origen: texto('Una de las dos clases.'),
        destino: texto('La otra.'),
        tipo: texto('Tipo, si hay varias entre esas dos clases.'),
        confirmado: { type: 'boolean', description: 'true solo si el usuario ya dijo que sí.' },
      },
      required: ['origen', 'destino'],
    },
  },
  {
    type: 'function' as const,
    name: 'ordenar_diagrama',
    description:
      'Recoloca TODAS las clases con un algoritmo: superclases arriba de sus subclases, lo ' +
      'relacionado cerca, nada encimado y las clases de asociación junto a su línea. Es lo ' +
      'que hay que usar cuando el diagrama está desordenado o las líneas se cruzan; no ' +
      'intentes colocarlas una por una.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    type: 'function' as const,
    name: 'cambiar_trazado',
    description:
      'Cambia la forma de una línea: recta, ortogonal (en ángulos rectos) o curva. La ' +
      'ortogonal es la que mejor evita que una línea pase por encima de una clase.',
    parameters: {
      type: 'object',
      properties: {
        origen: texto('Una de las dos clases.'),
        destino: texto('La otra.'),
        trazado: { type: 'string', enum: ['recta', 'ortogonal', 'curva'] },
      },
      required: ['origen', 'destino', 'trazado'],
    },
  },
  {
    type: 'function' as const,
    name: 'enderezar_relacion',
    description:
      'Quita los puntos de quiebre que se pusieron a mano en una línea y la deja recta otra vez.',
    parameters: {
      type: 'object',
      properties: { origen: texto('Una de las dos clases.'), destino: texto('La otra.') },
      required: ['origen', 'destino'],
    },
  },
  {
    type: 'function' as const,
    name: 'deshacer',
    description: 'Deshace el último cambio, venga del agente o del usuario.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
]

const EJECUTORES: Record<string, (args: never) => Resultado> = {
  resumen_diagrama: resumen,
  detalle_clase: detalle as (args: never) => Resultado,
  crear_clase: crearClase as (args: never) => Resultado,
  renombrar_clase: renombrar as (args: never) => Resultado,
  eliminar_clase: eliminar as (args: never) => Resultado,
  mover_clase: mover as (args: never) => Resultado,
  agregar_atributo: agregarAtributo as (args: never) => Resultado,
  modificar_atributo: modificarAtributo as (args: never) => Resultado,
  quitar_atributo: quitarAtributo as (args: never) => Resultado,
  agregar_operacion: agregarOperacion as (args: never) => Resultado,
  quitar_operacion: quitarOperacion as (args: never) => Resultado,
  crear_relacion: crearRelacion as (args: never) => Resultado,
  modificar_relacion: modificarRelacion as (args: never) => Resultado,
  eliminar_relacion: eliminarRelacion as (args: never) => Resultado,
  ordenar_diagrama: ordenarDiagrama,
  cambiar_trazado: cambiarTrazado as (args: never) => Resultado,
  enderezar_relacion: enderezarRelacion as (args: never) => Resultado,
  deshacer: deshacer,
}

/**
 * Ejecuta lo que pidió el agente.
 *
 * Nunca lanza: un fallo aquí tiene que volver como texto para que el agente se lo cuente al
 * usuario. Una excepción en medio de una llamada dejaría al agente esperando una respuesta
 * que no llega, callado, sin que nadie sepa por qué.
 */
export function ejecutarHerramienta(nombre: string, argumentos: unknown): Resultado {
  const ejecutor = EJECUTORES[nombre]

  if (ejecutor === undefined) return mal(`No existe una herramienta llamada "${nombre}".`)

  try {
    return ejecutor(argumentos as never)
  } catch (error) {
    return mal(error instanceof Error ? error.message : 'La acción falló por un motivo desconocido.')
  }
}
