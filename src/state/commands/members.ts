import { defineCommand } from '@/state/commands/defineCommand'
import type { Literal, Member, Operation, Parameter, Property } from '@/uml/model/types'

/**
 * Commands over compartment members. A member is addressed by
 * (nodeId, compartmentId, memberId): the compartment id comes from the
 * classifier spec, so these commands work for any compartment that ever
 * exists without being edited again.
 */

type MemberAddress = { nodeId: string; compartmentId: string; memberId: string }

function findMember(
  draft: { nodes: Record<string, { compartments: Record<string, Member[]> }> },
  address: MemberAddress,
): Member | undefined {
  return draft.nodes[address.nodeId]?.compartments[address.compartmentId]?.find(
    (member) => member.id === address.memberId,
  )
}

export const addMember = defineCommand(
  'member.add',
  (draft, payload: { nodeId: string; compartmentId: string; member: Member; index?: number }) => {
    const node = draft.nodes[payload.nodeId]
    if (!node) return

    const members = node.compartments[payload.compartmentId] ?? []
    node.compartments[payload.compartmentId] = members

    const index = payload.index ?? members.length
    members.splice(Math.min(Math.max(index, 0), members.length), 0, payload.member)
  },
)

export const removeMember = defineCommand('member.remove', (draft, payload: MemberAddress) => {
  const members = draft.nodes[payload.nodeId]?.compartments[payload.compartmentId]
  if (!members) return

  const index = members.findIndex((member) => member.id === payload.memberId)
  if (index >= 0) members.splice(index, 1)
})

/**
 * Patches fields of a single member.
 *
 * The patch carries its `kind` so the union stays honest: TypeScript then only
 * allows fields that exist on that variant, and the command refuses a patch
 * aimed at a different kind instead of writing nonsense onto the member. `id`
 * and `kind` themselves are not patchable — changing kind is a remove plus an
 * add.
 */
export type MemberPatch =
  | ({ kind: 'property' } & Partial<Omit<Property, 'kind' | 'id'>>)
  | ({ kind: 'operation' } & Partial<Omit<Operation, 'kind' | 'id'>>)
  | ({ kind: 'literal' } & Partial<Omit<Literal, 'kind' | 'id'>>)

export const updateMember = defineCommand(
  'member.update',
  (draft, payload: MemberAddress & { patch: MemberPatch }) => {
    const member = findMember(draft, payload)
    if (!member || member.kind !== payload.patch.kind) return

    Object.assign(member, payload.patch)
  },
)

/**
 * Renaming is its own command because `name` is the one field every member
 * variant shares, and it is the only one edited inline on the canvas.
 */
export const renameMember = defineCommand(
  'member.rename',
  (draft, payload: MemberAddress & { name: string }) => {
    const member = findMember(draft, payload)
    if (!member) return

    member.name = payload.name
  },
)

/** Reordering inside a compartment. */
export const moveMember = defineCommand(
  'member.move',
  (draft, payload: MemberAddress & { toIndex: number }) => {
    const members = draft.nodes[payload.nodeId]?.compartments[payload.compartmentId]
    if (!members) return

    const from = members.findIndex((member) => member.id === payload.memberId)
    if (from < 0) return

    const [member] = members.splice(from, 1)
    if (!member) return

    members.splice(Math.min(Math.max(payload.toIndex, 0), members.length), 0, member)
  },
)

function findOperation(
  draft: { nodes: Record<string, { compartments: Record<string, Member[]> }> },
  address: MemberAddress,
): Operation | undefined {
  const member = findMember(draft, address)
  return member?.kind === 'operation' ? member : undefined
}

export const addParameter = defineCommand(
  'member.addParameter',
  (draft, payload: MemberAddress & { parameter: Parameter; index?: number }) => {
    const operation = findOperation(draft, payload)
    if (!operation) return

    const index = payload.index ?? operation.parameters.length
    operation.parameters.splice(
      Math.min(Math.max(index, 0), operation.parameters.length),
      0,
      payload.parameter,
    )
  },
)

export const updateParameter = defineCommand(
  'member.updateParameter',
  (draft, payload: MemberAddress & { parameterId: string; patch: Partial<Omit<Parameter, 'id'>> }) => {
    const parameter = findOperation(draft, payload)?.parameters.find(
      (candidate) => candidate.id === payload.parameterId,
    )
    if (!parameter) return

    Object.assign(parameter, payload.patch)
  },
)

export const removeParameter = defineCommand(
  'member.removeParameter',
  (draft, payload: MemberAddress & { parameterId: string }) => {
    const operation = findOperation(draft, payload)
    if (!operation) return

    const index = operation.parameters.findIndex(
      (parameter) => parameter.id === payload.parameterId,
    )
    if (index >= 0) operation.parameters.splice(index, 1)
  },
)
