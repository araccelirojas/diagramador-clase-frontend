/**
 * La correspondencia entre nuestro modelo y XMI 2.1 / Enterprise Architect.
 *
 * Es el contrato de nomenclatura, y vive en un solo sitio a propósito: el importador y el
 * exportador leen estas mismas tablas, así que no pueden discrepar. Si mañana se registra
 * una relación nueva, aquí se nota que falta.
 *
 * Referencias: OMG XMI 2.1 (formato de serialización) y UML 2.5.1 §11 (Classifiers) para
 * los tipos, más la extensión `<xmi:Extension extender="Enterprise Architect">` para la
 * parte de presentación, que la especificación de UML no cubre.
 */

import type { Visibility } from '@/uml/model/types'

/** Espacios de nombres. XMI 2.1 es el formato por defecto de EA. */
export const NS = {
  xmi: 'http://schema.omg.org/spec/XMI/2.1',
  uml: 'http://schema.omg.org/spec/UML/2.1',
} as const

export const XMI_VERSION = '2.1'

/** EA rotula su extensión con la versión de esquema, no con la del producto. */
export const EA_EXTENDER = 'Enterprise Architect'
export const EA_EXTENDER_ID = '6.5'

// --- clasificadores ---

/**
 * Nuestros `kind` de nodo y su `xmi:type`.
 *
 * `association-class` es un solo elemento en UML 2.5: un AssociationClass ES a la vez una
 * Association y una Class. Nuestro modelo lo parte en un nodo y una arista (§5.4.6), así que
 * al exportar se vuelven a fundir y al importar se vuelven a partir.
 */
export const TIPO_XMI_POR_CLASIFICADOR: Record<string, string> = {
  class: 'uml:Class',
  interface: 'uml:Interface',
  'association-class': 'uml:AssociationClass',
}

export const CLASIFICADOR_POR_TIPO_XMI: Record<string, string> = {
  'uml:Class': 'class',
  'uml:Interface': 'interface',
  'uml:AssociationClass': 'association-class',
  // Lo que EA escribe para una clase con estereotipo de tabla: sigue siendo una clase.
  'uml:Component': 'class',
}

// --- relaciones ---

/**
 * Cómo se escribe cada relación nuestra.
 *
 * `elemento` es el `xmi:type` cuando la relación es un `packagedElement` propio. La
 * generalización es la excepción: en XMI va ANIDADA dentro de la subclase, no suelta en el
 * paquete, y por eso se marca aparte.
 */
export type FormaRelacion = {
  /** `xmi:type` del elemento, o null si no se escribe como packagedElement. */
  elemento: string | null
  /** Va dentro de la clase de origen en vez de en el paquete. */
  anidadaEnOrigen?: boolean
  /**
   * `aggregation` del extremo. UML la pone en el extremo tipado por la PARTE, no por el
   * todo: en "Coche tiene Ruedas", la propiedad `ruedas: Rueda[*]` es la que lleva
   * `composite`. Como nuestro origen es el todo, le toca al extremo de DESTINO.
   */
  agregacionEnDestino?: 'shared' | 'composite'
  /** Una punta de flecha abierta: el destino es navegable y el origen no. */
  dirigida?: boolean
  /** Lleva una clase colgando (el nodo con `associationId`). */
  conClase?: boolean
}

export const FORMA_POR_RELACION: Record<string, FormaRelacion> = {
  association: { elemento: 'uml:Association' },
  'directed-association': { elemento: 'uml:Association', dirigida: true },
  aggregation: { elemento: 'uml:Association', agregacionEnDestino: 'shared' },
  composition: { elemento: 'uml:Association', agregacionEnDestino: 'composite' },
  generalization: { elemento: 'uml:Generalization', anidadaEnOrigen: true },
  realization: { elemento: 'uml:Realization' },
  'association-class': { elemento: 'uml:AssociationClass', conClase: true },
}

/** Lo que EA pone en `<properties ea_type="…">` de su extensión, por relación nuestra. */
export const EA_TYPE_POR_RELACION: Record<string, string> = {
  association: 'Association',
  'directed-association': 'Association',
  aggregation: 'Aggregation',
  composition: 'Aggregation',
  generalization: 'Generalization',
  realization: 'Realisation',
  'association-class': 'Association',
}

// --- visibilidad ---

export const VISIBILIDAD_XMI: Record<Visibility, string> = {
  '+': 'public',
  '-': 'private',
  '#': 'protected',
  '~': 'package',
}

export const VISIBILIDAD_DESDE_XMI: Record<string, Visibility> = {
  public: '+',
  private: '-',
  protected: '#',
  package: '~',
}

// --- multiplicidades ---

/**
 * UML no guarda "0..*" como texto: guarda `lowerValue` y `upperValue` por separado, y el
 * infinito se escribe "*". Estas dos funciones son la traducción, y son inversas.
 */
export function limitesDeMultiplicidad(
  multiplicidad: string | null,
): { inferior: string; superior: string } | null {
  if (multiplicidad === null) return null

  const texto = multiplicidad.trim()
  if (texto === '') return null

  const partes = texto.split('..')

  if (partes.length === 1) {
    // "1" es 1..1; "*" es 0..*, que es lo que dice UML 2.5 §7.5.4.
    const solo = partes[0]!.trim()
    return solo === '*' ? { inferior: '0', superior: '*' } : { inferior: solo, superior: solo }
  }

  return { inferior: partes[0]!.trim(), superior: partes[1]!.trim() }
}

export function multiplicidadDesdeLimites(
  inferior: string | null,
  superior: string | null,
): string | null {
  if (inferior === null && superior === null) return null

  const bajo = (inferior ?? '0').trim()
  // Enterprise Architect escribe el infinito como -1, no como "*". Sin esto salen
  // multiplicidades tipo "0..-1", que ni son válidas ni significan nada.
  const crudo = (superior ?? '1').trim()
  const alto = crudo === '-1' ? '*' : crudo

  // Se devuelve la forma corta que escribiría una persona, no "1..1".
  if (bajo === alto) return bajo
  if (bajo === '0' && alto === '*') return '0..*'

  return `${bajo}..${alto}`
}
