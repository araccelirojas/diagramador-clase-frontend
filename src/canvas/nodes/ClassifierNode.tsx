import { useSyncExternalStore } from 'react'
import {
  Handle,
  NodeResizer,
  Position,
  useConnection,
  type NodeProps,
} from '@xyflow/react'
import { useState } from 'react'

import { canConnect } from '@/canvas/interaction/connectionRules'
import { Compartment } from '@/canvas/nodes/Compartment'
import { InlineInput } from '@/canvas/nodes/InlineInput'
import {
  NODE_BORDER_IDLE,
  NODE_BORDER_INVALID,
  NODE_BORDER_PENDING,
  NODE_BORDER_SELECTED,
  NODE_BORDER_VALID,
  NODE_BOX,
  NODE_HEADER,
  NODE_KEYWORD,
  NODE_NAME,
  NODE_NAME_ABSTRACT,
  NODE_BORDER_AGENTE,
} from '@/canvas/nodes/nodeStyles'
import { estaResaltado, onResaltado } from '@/voz/resaltado'
import { renameNode } from '@/state/commands'
import type { UmlFlowNode } from '@/state/selectors'
import { useDiagramStore } from '@/state/useDiagramStore'
import { formatKeywords } from '@/uml/model/format'
import { getClassifier } from '@/uml/registry'

type Editing = { kind: 'name' } | { kind: 'member'; id: string } | null

const MIN_WIDTH = 140
const MIN_HEIGHT = 60

/**
 * THE node component. One file covers class, interface, abstract class,
 * datatype and enumeration, because everything it draws comes from the spec:
 * the header from `defaultKeywords`/`nameStyle`, the body from `compartments`.
 *
 * If you ever need an `if (kind === ...)` here, the registry has a hole (§15).
 */
export function ClassifierNode({ id, data, selected }: NodeProps<UmlFlowNode>) {
  const { node } = data
  const spec = getClassifier(node.kind)
  const dispatch = useDiagramStore((state) => state.dispatch)
  const tool = useDiagramStore((state) => state.tool)
  const doc = useDiagramStore((state) => state.doc)
  const pendingConnection = useDiagramStore((state) => state.pendingConnection)
  const connection = useConnection()
  const [editing, setEditing] = useState<Editing>(null)

  const keywords = formatKeywords(
    node.keywords.length > 0 ? node.keywords : (spec.defaultKeywords ?? []),
  )
  const isItalic = node.isAbstract || spec.nameStyle?.italic === true

  /**
   * The box-wide handle only accepts pointer events while a relation tool is
   * armed. Otherwise it would sit on top of the content and swallow the double
   * clicks that open the inline editors.
   */
  const isRelationTool = tool.kind === 'relation'
  const relationKind = isRelationTool ? tool.relationKind : null

  const isConnectionSource =
    connection.inProgress ? connection.fromNode?.id === id : pendingConnection?.sourceId === id

  const connectionOrigin = connection.inProgress
    ? connection.fromNode?.id
    : (pendingConnection?.sourceId ?? null)

  const isCandidate =
    relationKind !== null && connectionOrigin != null && connectionOrigin !== id

  const isValidTarget = isCandidate && canConnect(doc, relationKind, connectionOrigin, id)

  /**
   * El destello de lo que acaba de tocar el agente de voz.
   *
   * Va por debajo de todo lo demas en la cascada: si estás conectando o el nodo está
   * seleccionado, eso es lo que tenés que ver. El destello solo informa de algo que ya pasó.
   */
  const porElAgente = useSyncExternalStore(
    onResaltado,
    () => estaResaltado(id),
    () => false,
  )

  const border = isConnectionSource
    ? NODE_BORDER_PENDING
    : isCandidate
      ? isValidTarget
        ? NODE_BORDER_VALID
        : NODE_BORDER_INVALID
      : selected === true
        ? NODE_BORDER_SELECTED
        : porElAgente
          ? NODE_BORDER_AGENTE
          : NODE_BORDER_IDLE

  return (
    <>
      <NodeResizer
        isVisible={selected === true && !isRelationTool}
        minWidth={MIN_WIDTH}
        minHeight={MIN_HEIGHT}
        lineClassName="border-sky-400"
        handleClassName="h-2 w-2 rounded-xs border border-sky-500 bg-white"
      />

      {/* One invisible handle covering the whole box: edges are floating, so the
          anchor is computed from the geometry and there are no corner dots. */}
      <Handle
        type="source"
        position={Position.Left}
        isConnectableStart={isRelationTool}
        isConnectableEnd={isRelationTool}
        className={`!h-full !w-full !transform-none !rounded-none !border-0 !bg-transparent !opacity-0 ${
          isRelationTool ? '!cursor-crosshair' : '!pointer-events-none'
        }`}
      />

      <div className={`${NODE_BOX} ${border}`}>
        <div className={NODE_HEADER}>
          {keywords ? <span className={NODE_KEYWORD}>{keywords}</span> : null}

          {editing?.kind === 'name' ? (
            <InlineInput
              value={node.name}
              className="text-center text-[13px] font-semibold"
              onCommit={(name) => {
                dispatch(renameNode({ id, name }))
                setEditing(null)
              }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <span
              className={`${NODE_NAME} ${isItalic ? NODE_NAME_ABSTRACT : ''}`}
              onDoubleClick={(event) => {
                event.stopPropagation()
                setEditing({ kind: 'name' })
              }}
            >
              {node.name}
            </span>
          )}
        </div>

        {spec.compartments.map((compartment) => (
          <Compartment
            key={compartment.id}
            node={node}
            spec={compartment}
            editingMemberId={editing?.kind === 'member' ? editing.id : null}
            onEditMember={(memberId) =>
              setEditing(memberId === null ? null : { kind: 'member', id: memberId })
            }
          />
        ))}
      </div>
    </>
  )
}
