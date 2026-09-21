/**
 * The canonical document model (CLAUDE.md §5).
 *
 * This is the contract with the backend's `contenido` column and with the
 * exported `.uml.json` file: the very same object, one single format.
 * Nothing here may import React or @xyflow/react.
 */

/** Key of a classifier spec in the registry ('class', 'interface', ...). */
export type ClassifierKind = string

/** Key of a relation spec in the registry ('association', 'composition', ...). */
export type RelationKind = string

export type Visibility = '+' | '-' | '#' | '~'

export type ParameterDirection = 'in' | 'out' | 'inout' | 'return'

export type Parameter = {
  id: string
  name: string
  type: string | null
  direction: ParameterDirection
  defaultValue: string | null
}

export type Property = {
  kind: 'property'
  id: string
  name: string
  type: string | null
  visibility: Visibility
  /** '1', '0..*', '1..*' */
  multiplicity: string | null
  defaultValue: string | null
  isStatic: boolean
  /** Rendered as /name */
  isDerived: boolean
  isReadOnly: boolean
  /**
   * The `{id}` modifier of UML 2.5: this property is part of what identifies an
   * instance of its classifier. It is what the exporter turns into the primary
   * key, instead of inventing a surrogate `id` nobody asked for.
   */
  isId: boolean
  isOrdered: boolean
  isUnique: boolean
}

export type Operation = {
  kind: 'operation'
  id: string
  name: string
  visibility: Visibility
  parameters: Parameter[]
  returnType: string | null
  isStatic: boolean
  isAbstract: boolean
  /** {query} */
  isQuery: boolean
}

export type Literal = {
  kind: 'literal'
  id: string
  name: string
}

/** Discriminated by `kind`: a new member variant forces every switch to cover it. */
export type Member = Property | Operation | Literal

export type MemberKind = Member['kind']

export type Position = { x: number; y: number }

export type Size = {
  width: number
  /** null = height derived from the content; a number only if the user resized it. */
  height: number | null
}

export type NodeStyle = {
  fill?: string
  stroke?: string
}

export type UmlNode = {
  /** 'n_' + nanoid(8) */
  id: string
  diagramId: string
  kind: ClassifierKind
  name: string

  /** Stereotypes: ['entity'] renders as «entity» */
  keywords: string[]
  isAbstract: boolean
  visibility: Visibility

  // --- presentation layer (layout), not the UML model ---
  /** ABSOLUTE, in world units. Never normalized. */
  position: Position
  size: Size
  z: number
  style?: NodeStyle

  /** Containing package, or null. */
  parentId: string | null

  /**
   * The association this node is the class OF, or null for an ordinary node.
   *
   * In UML 2.5 an AssociationClass is a SINGLE element that is at once an
   * Association and a Class. This model keeps nodes and edges in separate
   * collections, so it is stored as a node that points at its edge — and the
   * pointer lives on the node because the node is the dependent half: an
   * association survives losing its class, a class cannot survive losing its
   * association (§5.4.6).
   */
  associationId: string | null

  /**
   * Compartments indexed by the id declared in the classifier spec.
   * A class uses 'attributes' and 'operations'; an enum uses 'literals'.
   * Adding a compartment does NOT require changing this type.
   */
  compartments: Record<string, Member[]>
}

export type AssociationEnd = {
  role: string | null
  multiplicity: string | null
  visibility: Visibility | null
  /** null = unspecified. UML distinguishes it from false. */
  navigable: boolean | null
  isOrdered: boolean
  isUnique: boolean
}

/** Reading direction of the association name: the little triangle. */
export type NameDirection = 'none' | 'sourceToTarget' | 'targetToSource'

export type EdgeRouting = 'straight' | 'orthogonal' | 'bezier'

export type UmlEdge = {
  /** 'e_' + nanoid(8) */
  id: string
  diagramId: string
  kind: RelationKind
  /** Node id. */
  source: string
  /** Node id. */
  target: string
  name: string | null
  nameDirection: NameDirection

  ends: {
    source: AssociationEnd
    target: AssociationEnd
  }

  // --- layout ---
  waypoints: Position[]
  routing: EdgeRouting
}

export type Viewport = { x: number; y: number; zoom: number }

/** A tab / view. In phase 1 there is always exactly one: 'd_main'. */
export type Diagram = {
  id: string
  name: string
  viewport: Viewport
}

export type DocumentMeta = {
  name: string
  /** ISO 8601 */
  createdAt: string
  /** ISO 8601 */
  updatedAt: string
}

export type UmlDocument = {
  schemaVersion: number
  kind: 'uml-class-model'
  meta: DocumentMeta
  diagrams: Diagram[]
  /** Indexed by id, NOT an array (CLAUDE.md §11.1). */
  nodes: Record<string, UmlNode>
  /** Indexed by id, NOT an array. */
  edges: Record<string, UmlEdge>
}

export type IssueSeverity = 'error' | 'warning'

/** Produced by validators and by spec-level `validate` hooks. Serializable. */
export type Issue = {
  code: string
  severity: IssueSeverity
  message: string
  target:
    | { kind: 'document' }
    | { kind: 'node'; id: string }
    | { kind: 'edge'; id: string }
    | { kind: 'member'; nodeId: string; compartmentId: string; id: string }
}
