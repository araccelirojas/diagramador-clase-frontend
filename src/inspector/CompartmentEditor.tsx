import { useState } from 'react'

import {
  CARD,
  DANGER_BUTTON,
  EMPTY_HINT,
  SECTION,
  SECTION_TITLE,
  SMALL_BUTTON,
} from '@/inspector/inspectorStyles'
import { MemberEditor } from '@/inspector/members/MemberEditor'
import { addMember, moveMember, removeMember } from '@/state/commands'
import { useDiagramStore } from '@/state/useDiagramStore'
import { createMember } from '@/uml/model/factories'
import { formatMember } from '@/uml/model/format'
import type { UmlNode } from '@/uml/model/types'
import type { CompartmentSpec } from '@/uml/registry'

type CompartmentEditorProps = {
  node: UmlNode
  spec: CompartmentSpec
}

/**
 * One compartment of the inspector, driven by its CompartmentSpec exactly like
 * the canvas one: it asks the spec which member kind to create and never names
 * "attributes" or "operations" itself.
 */
export function CompartmentEditor({ node, spec }: CompartmentEditorProps) {
  const dispatch = useDiagramStore((state) => state.dispatch)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const members = node.compartments[spec.id] ?? []

  const add = (): void => {
    const member = createMember(spec.memberKind)
    dispatch(addMember({ nodeId: node.id, compartmentId: spec.id, member }))
    setExpandedId(member.id)
  }

  return (
    <section className={SECTION}>
      <h3 className={SECTION_TITLE}>
        <span>{spec.label}</span>
        <button type="button" className={SMALL_BUTTON} onClick={add}>
          + agregar
        </button>
      </h3>

      {members.length === 0 ? (
        <p className={EMPTY_HINT}>vacío</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {members.map((member, index) => {
            const isExpanded = expandedId === member.id
            const address = { nodeId: node.id, compartmentId: spec.id, memberId: member.id }

            return (
              <li key={member.id} className={isExpanded ? CARD : undefined}>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="flex-1 truncate rounded-sm px-1 py-0.5 text-left font-mono text-[11px] text-slate-700 hover:bg-slate-100"
                    onClick={() => setExpandedId(isExpanded ? null : member.id)}
                    title={isExpanded ? 'Contraer' : 'Editar'}
                  >
                    {formatMember(member)}
                  </button>

                  <button
                    type="button"
                    className={SMALL_BUTTON}
                    disabled={index === 0}
                    onClick={() => dispatch(moveMember({ ...address, toIndex: index - 1 }))}
                    aria-label="Subir"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={SMALL_BUTTON}
                    disabled={index === members.length - 1}
                    onClick={() => dispatch(moveMember({ ...address, toIndex: index + 1 }))}
                    aria-label="Bajar"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={DANGER_BUTTON}
                    onClick={() => dispatch(removeMember(address))}
                    aria-label="Eliminar"
                  >
                    ✕
                  </button>
                </div>

                {isExpanded ? (
                  <div className="mt-2">
                    <MemberEditor nodeId={node.id} compartmentId={spec.id} member={member} />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
