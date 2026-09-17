import { TextField } from '@/inspector/fields/TextField'
import { OperationEditor } from '@/inspector/members/OperationEditor'
import { PropertyEditor } from '@/inspector/members/PropertyEditor'
import { updateMember } from '@/state/commands'
import { useDiagramStore } from '@/state/useDiagramStore'
import type { Member } from '@/uml/model/types'

type MemberEditorProps = {
  nodeId: string
  compartmentId: string
  member: Member
}

/**
 * Picks the editor for the member variant. This switch is exhaustive: adding a
 * member kind to the model makes TypeScript demand its editor here, which is
 * exactly the step CLAUDE.md §7.4 describes.
 *
 * Note this dispatches on the MEMBER kind, not on the classifier kind — adding
 * a classifier never touches this file.
 */
export function MemberEditor({ nodeId, compartmentId, member }: MemberEditorProps) {
  const dispatch = useDiagramStore((state) => state.dispatch)
  const address = { nodeId, compartmentId, memberId: member.id }

  switch (member.kind) {
    case 'property':
      return (
        <PropertyEditor
          property={member}
          onPatch={(patch) => dispatch(updateMember({ ...address, patch: { kind: 'property', ...patch } }))}
        />
      )

    case 'operation':
      return (
        <OperationEditor
          nodeId={nodeId}
          compartmentId={compartmentId}
          operation={member}
          onPatch={(patch) => dispatch(updateMember({ ...address, patch: { kind: 'operation', ...patch } }))}
        />
      )

    case 'literal':
      return (
        <TextField
          label="Nombre"
          value={member.name}
          onCommit={(name) =>
            dispatch(updateMember({ ...address, patch: { kind: 'literal', name: name ?? '' } }))
          }
          mono
        />
      )
  }
}
