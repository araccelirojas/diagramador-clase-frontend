import type { LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'

import type {
  AssociationEnd,
  Issue,
  MemberKind,
  Size,
  UmlDocument,
  UmlEdge,
  UmlNode,
} from '@/uml/model/types'

/**
 * The registry (CLAUDE.md §7): the reason this architecture exists.
 *
 * A new UML element is a spec file, not a React component. If adding one forces
 * you to edit ClassifierNode, UmlEdge or the Inspector, the abstraction has a
 * hole — stop and report it (§15).
 */

export type CompartmentSpec = {
  /** Key inside `node.compartments`. Persisted, so keep it stable. */
  id: string
  /** Shown in the inspector. */
  label: string
  memberKind: MemberKind
  hideWhenEmpty?: boolean
  separator?: 'line' | 'none'
}

/**
 * A kind of compartment member, as a palette tool. Adding a member variant to
 * the model means adding a spec here, and the palette picks it up on its own.
 */
export type MemberSpec = {
  kind: MemberKind
  /** Singular, for the palette button: 'Atributo', not 'Atributos'. */
  label: string
  icon: LucideIcon
  hint: string
}

export type ClassifierRenderProps = {
  node: UmlNode
  spec: ClassifierSpec
  isSelected: boolean
}

/**
 * An extra palette button that creates this same kind with different defaults.
 *
 * This is how "Clase abstracta" exists as a tool without existing as a second
 * `kind`: abstractness is `isAbstract` on the node (§5.2), and duplicating it
 * as its own spec would put two different truths in the document.
 */
export type ClassifierVariant = {
  id: string
  label: string
  icon: LucideIcon
  defaults: Partial<Pick<UmlNode, 'name' | 'isAbstract' | 'keywords'>>
}

export type ClassifierSpec = {
  kind: string
  /** Palette text. */
  label: string
  icon: LucideIcon
  group: 'classifiers' | 'structure' | 'annotations'

  /** ['interface'] renders as «interface». */
  defaultKeywords?: string[]
  defaultName: string
  defaultSize: Size
  nameStyle?: { italic?: boolean; centered?: boolean }
  header?: 'compartment' | 'tab' | 'plain'

  compartments: CompartmentSpec[]

  canBeAbstract: boolean
  variants?: ClassifierVariant[]
  canContain?: (childKind: string) => boolean
  validate?: (node: UmlNode, doc: UmlDocument) => Issue[]

  /** Escape hatch for nodes that are not a box of compartments (note, package). */
  render?: ComponentType<ClassifierRenderProps>
}

/**
 * Names of the arrow heads. The actual SVG ids live in canvas/markers, so the
 * registry stays free of anything that knows about rendering.
 */
export type MarkerId =
  | 'arrowOpen'
  | 'triangleHollow'
  | 'diamondHollow'
  | 'diamondFilled'
  | 'circleFilled'

export type RelationSupports = {
  multiplicity: boolean
  roles: boolean
  name: boolean
  navigability: boolean
}

export type RelationSpec = {
  kind: string
  label: string
  icon: LucideIcon

  line: 'solid' | 'dashed'
  sourceMarker: MarkerId | null
  targetMarker: MarkerId | null

  supports: RelationSupports

  defaultEnds?: Partial<{
    source: Partial<AssociationEnd>
    target: Partial<AssociationEnd>
  }>

  /** Consulted live while the user drags a connection. */
  isValidConnection?: (source: UmlNode, target: UmlNode, doc: UmlDocument) => boolean

  /**
   * Shown when `isValidConnection` says no. It lives in the spec so explaining
   * a rule never means adding an `if` by kind to shared code.
   */
  connectionHint?: string
  validate?: (edge: UmlEdge, doc: UmlDocument) => Issue[]

  /** How this maps onto the strict UML 2.5 metamodel, for the future exporter. */
  metamodelNote?: string
}
