import { nanoid } from 'nanoid'

import { SCHEMA_VERSION, DOCUMENT_KIND } from '@/uml/model/schema'
import type {
  AssociationEnd,
  ClassifierKind,
  Diagram,
  Literal,
  Member,
  MemberKind,
  Operation,
  Parameter,
  Position,
  Property,
  RelationKind,
  Size,
  UmlDocument,
  UmlEdge,
  UmlNode,
  Visibility,
} from '@/uml/model/types'

/**
 * Factories for the document model. They take plain option objects, never
 * registry specs: `uml/model` must not depend on `uml/registry`. The caller
 * reads the spec and passes the defaults it declares.
 */

/** Phase 1 always has exactly one diagram. */
export const MAIN_DIAGRAM_ID = 'd_main'

const ID_LENGTH = 8

export const newNodeId = (): string => `n_${nanoid(ID_LENGTH)}`
export const newEdgeId = (): string => `e_${nanoid(ID_LENGTH)}`
export const newMemberId = (): string => `m_${nanoid(ID_LENGTH)}`
export const newParameterId = (): string => `p_${nanoid(ID_LENGTH)}`

export const DEFAULT_VISIBILITY: Visibility = '+'

export const DEFAULT_NODE_SIZE: Size = { width: 200, height: null }

export function createAssociationEnd(overrides: Partial<AssociationEnd> = {}): AssociationEnd {
  return {
    role: null,
    multiplicity: null,
    visibility: null,
    navigable: null,
    isOrdered: false,
    isUnique: true,
    ...overrides,
  }
}

export type CreateParameterOptions = Partial<Omit<Parameter, 'id'>> & { id?: string }

export function createParameter(options: CreateParameterOptions = {}): Parameter {
  const { id = newParameterId(), ...rest } = options
  return {
    id,
    name: 'parametro',
    type: null,
    direction: 'in',
    defaultValue: null,
    ...rest,
  }
}

export type CreatePropertyOptions = Partial<Omit<Property, 'id' | 'kind'>> & { id?: string }

export function createProperty(options: CreatePropertyOptions = {}): Property {
  const { id = newMemberId(), ...rest } = options
  return {
    kind: 'property',
    id,
    name: 'atributo',
    type: null,
    visibility: '-',
    multiplicity: null,
    defaultValue: null,
    isStatic: false,
    isDerived: false,
    isReadOnly: false,
    isId: false,
    isOrdered: false,
    isUnique: true,
    ...rest,
  }
}

export type CreateOperationOptions = Partial<Omit<Operation, 'id' | 'kind'>> & { id?: string }

export function createOperation(options: CreateOperationOptions = {}): Operation {
  const { id = newMemberId(), ...rest } = options
  return {
    kind: 'operation',
    id,
    name: 'operacion',
    visibility: '+',
    parameters: [],
    returnType: null,
    isStatic: false,
    isAbstract: false,
    isQuery: false,
    ...rest,
  }
}

export type CreateLiteralOptions = Partial<Omit<Literal, 'id' | 'kind'>> & { id?: string }

export function createLiteral(options: CreateLiteralOptions = {}): Literal {
  const { id = newMemberId(), ...rest } = options
  return {
    kind: 'literal',
    id,
    name: 'LITERAL',
    ...rest,
  }
}

/**
 * Creates an empty member of the kind a compartment declares. A new member
 * variant must be added here, and TypeScript points at every other place.
 */
export function createMember(kind: MemberKind): Member {
  switch (kind) {
    case 'property':
      return createProperty()
    case 'operation':
      return createOperation()
    case 'literal':
      return createLiteral()
  }
}

export type CreateNodeOptions = {
  kind: ClassifierKind
  position: Position
  /** Compartment ids declared by the classifier spec, in order. */
  compartmentIds: readonly string[]
  id?: string
  diagramId?: string
  name?: string
  keywords?: string[]
  isAbstract?: boolean
  visibility?: Visibility
  size?: Size
  z?: number
  parentId?: string | null
  /** Set only for an association class: the edge it is the class of. */
  associationId?: string | null
}

export function createNode(options: CreateNodeOptions): UmlNode {
  const compartments: Record<string, Member[]> = {}
  for (const compartmentId of options.compartmentIds) {
    compartments[compartmentId] = []
  }

  return {
    id: options.id ?? newNodeId(),
    diagramId: options.diagramId ?? MAIN_DIAGRAM_ID,
    kind: options.kind,
    name: options.name ?? 'Clase',
    keywords: options.keywords ?? [],
    isAbstract: options.isAbstract ?? false,
    visibility: options.visibility ?? DEFAULT_VISIBILITY,
    position: { ...options.position },
    size: options.size ? { ...options.size } : { ...DEFAULT_NODE_SIZE },
    z: options.z ?? 0,
    parentId: options.parentId ?? null,
    associationId: options.associationId ?? null,
    compartments,
  }
}

export type CreateEdgeOptions = {
  kind: RelationKind
  source: string
  target: string
  id?: string
  diagramId?: string
  name?: string | null
  nameDirection?: UmlEdge['nameDirection']
  ends?: { source?: Partial<AssociationEnd>; target?: Partial<AssociationEnd> }
  routing?: UmlEdge['routing']
  waypoints?: Position[]
}

export function createEdge(options: CreateEdgeOptions): UmlEdge {
  return {
    id: options.id ?? newEdgeId(),
    diagramId: options.diagramId ?? MAIN_DIAGRAM_ID,
    kind: options.kind,
    source: options.source,
    target: options.target,
    name: options.name ?? null,
    nameDirection: options.nameDirection ?? 'none',
    ends: {
      source: createAssociationEnd(options.ends?.source),
      target: createAssociationEnd(options.ends?.target),
    },
    waypoints: options.waypoints?.map((point) => ({ ...point })) ?? [],
    routing: options.routing ?? 'straight',
  }
}

export function createDiagram(options: Partial<Diagram> = {}): Diagram {
  return {
    id: options.id ?? MAIN_DIAGRAM_ID,
    name: options.name ?? 'Modelo de dominio',
    viewport: options.viewport ?? { x: 0, y: 0, zoom: 1 },
  }
}

export type CreateDocumentOptions = {
  name?: string
  /** ISO timestamp; injectable so tests stay deterministic. */
  now?: string
}

export function createDocument(options: CreateDocumentOptions = {}): UmlDocument {
  const now = options.now ?? new Date().toISOString()

  return {
    schemaVersion: SCHEMA_VERSION,
    kind: DOCUMENT_KIND,
    meta: {
      name: options.name ?? 'Modelo sin título',
      createdAt: now,
      updatedAt: now,
    },
    diagrams: [createDiagram()],
    nodes: {},
    edges: {},
  }
}
