import { InlineInput } from '@/canvas/nodes/InlineInput'
import {
  COMPARTMENT,
  COMPARTMENT_EMPTY,
  COMPARTMENT_SEPARATOR,
  MEMBER_ABSTRACT,
  MEMBER_ROW,
  MEMBER_STATIC,
} from '@/canvas/nodes/nodeStyles'
import { renameMember } from '@/state/commands'
import { useDiagramStore } from '@/state/useDiagramStore'
import { formatMember } from '@/uml/model/format'
import type { Member, UmlNode } from '@/uml/model/types'
import type { CompartmentSpec } from '@/uml/registry'

type CompartmentProps = {
  node: UmlNode
  spec: CompartmentSpec
  editingMemberId: string | null
  onEditMember: (memberId: string | null) => void
}

function memberClassName(member: Member): string {
  const modifiers: string[] = [MEMBER_ROW]

  if (member.kind !== 'literal' && member.isStatic) modifiers.push(MEMBER_STATIC)
  if (member.kind === 'operation' && member.isAbstract) modifiers.push(MEMBER_ABSTRACT)

  return modifiers.join(' ')
}

/**
 * One compartment, driven entirely by its CompartmentSpec. It does not know
 * whether it is holding attributes, operations or enum literals: it asks the
 * spec for the member kind and the formatter for the text.
 *
 * Members are added from the palette, never by double clicking the canvas: one
 * way to create things, and no accidental attributes.
 */
export function Compartment({ node, spec, editingMemberId, onEditMember }: CompartmentProps) {
  const dispatch = useDiagramStore((state) => state.dispatch)
  const members = node.compartments[spec.id] ?? []

  if (spec.hideWhenEmpty && members.length === 0) return null

  const separator = spec.separator === 'none' ? '' : COMPARTMENT_SEPARATOR

  return (
    <div className={`${COMPARTMENT} ${separator}`}>
      {members.length === 0 ? (
        // An empty compartment is drawn empty, as UML does.
        <div className={COMPARTMENT_EMPTY} />
      ) : (
        members.map((member) =>
          member.id === editingMemberId ? (
            <InlineInput
              key={member.id}
              value={member.name}
              onCommit={(name) => {
                dispatch(
                  renameMember({ nodeId: node.id, compartmentId: spec.id, memberId: member.id, name }),
                )
                onEditMember(null)
              }}
              onCancel={() => onEditMember(null)}
            />
          ) : (
            <span
              key={member.id}
              className={memberClassName(member)}
              title={formatMember(member)}
              onDoubleClick={(event) => {
                event.stopPropagation()
                onEditMember(member.id)
              }}
            >
              {formatMember(member)}
            </span>
          ),
        )
      )}
    </div>
  )
}
