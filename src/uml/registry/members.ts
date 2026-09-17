import { Braces, ListOrdered, Variable } from 'lucide-react'

import type { MemberKind } from '@/uml/model/types'
import type { MemberSpec } from '@/uml/registry/types'

/**
 * Member tools (CLAUDE.md §7). The palette shows one of these only when some
 * registered classifier declares a compartment for that member kind, so
 * "Literal" stays hidden until enumerations exist in phase 2.
 */
const SPECS: MemberSpec[] = [
  {
    kind: 'property',
    label: 'Atributo',
    icon: Variable,
    hint: 'soltalo sobre una clase, o hacé clic acá y después en la clase',
  },
  {
    kind: 'operation',
    label: 'Operación',
    icon: Braces,
    hint: 'soltalo sobre una clase, o hacé clic acá y después en la clase',
  },
  {
    kind: 'literal',
    label: 'Literal',
    icon: ListOrdered,
    hint: 'soltalo sobre una enumeración',
  },
]

export const MEMBERS: Record<MemberKind, MemberSpec> = Object.fromEntries(
  SPECS.map((spec) => [spec.kind, spec]),
) as Record<MemberKind, MemberSpec>

export const MEMBER_LIST: readonly MemberSpec[] = SPECS
