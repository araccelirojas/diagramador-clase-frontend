import { useInternalNode, useStore, ViewportPortal } from '@xyflow/react'

import type { RemoteHighlights } from '@/state/selectors'
import { participantColor } from '@/sync/presence'
import { usePresenceStore } from '@/sync/usePresenceStore'

/**
 * Other people in the room, drawn on the canvas (CU-01): their pointers and a
 * name tag over whatever box they have selected.
 *
 * Everything is placed in WORLD coordinates inside React Flow's own viewport
 * transform (`ViewportPortal`), so panning and zooming move it for free and
 * there is no zoom arithmetic here (CLAUDE.md §14.7). What must NOT zoom — the
 * arrow and the label — is counter-scaled by 1/zoom so it stays readable.
 */

const zoomSelector = (state: { transform: [number, number, number] }) => state.transform[2]

function CursorArrow({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" className="drop-shadow-sm">
      <path
        d="M2 1.5 L2 15 L6 11.2 L8.8 17 L11.2 15.9 L8.5 10.3 L14 10.3 Z"
        fill={color}
        stroke="white"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function RemoteCursors() {
  const zoom = useStore(zoomSelector)
  const cursors = usePresenceStore((state) => state.cursors)
  const participants = usePresenceStore((state) => state.participants)
  const selfId = usePresenceStore((state) => state.selfId)

  return (
    <>
      {Object.entries(cursors).map(([idSocket, point]) => {
        const participant = participants[idSocket]
        if (!participant || idSocket === selfId) return null

        const color = participantColor(participant.idUsuario)

        return (
          <div
            key={idSocket}
            className="pointer-events-none absolute top-0 left-0 transition-transform duration-75 ease-linear"
            style={{
              transform: `translate(${point.x}px, ${point.y}px) scale(${1 / zoom})`,
              transformOrigin: '0 0',
              zIndex: 1000,
            }}
          >
            <CursorArrow color={color} />
            <span
              className="absolute top-4 left-3 rounded-sm px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-white shadow-sm"
              style={{ backgroundColor: color }}
            >
              {participant.nombre}
            </span>
          </div>
        )
      })}
    </>
  )
}

function SelectionTag({ nodeId, color, nombre, offset }: {
  nodeId: string
  color: string
  nombre: string
  offset: number
}) {
  const zoom = useStore(zoomSelector)
  // Subscribes to this node only: the tag follows the box while it is dragged.
  const node = useInternalNode(nodeId)
  if (!node) return null

  const { x, y } = node.internals.positionAbsolute

  return (
    <div
      className="pointer-events-none absolute top-0 left-0"
      style={{
        transform: `translate(${x}px, ${y}px) scale(${1 / zoom}) translate(${offset}px, -100%)`,
        transformOrigin: '0 0',
        zIndex: 999,
      }}
    >
      <span
        className="mb-1 block rounded-t-sm px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-white"
        style={{ backgroundColor: color }}
      >
        {nombre}
      </span>
    </div>
  )
}

/** Name tags over boxes other people have selected. The rings are in `selectors.ts`. */
function RemoteSelectionTags({ highlights }: { highlights: RemoteHighlights }) {
  return (
    <>
      {[...highlights.nodes.entries()].flatMap(([nodeId, list]) =>
        list.map((highlight, index) => (
          <SelectionTag
            key={`${nodeId}:${highlight.idSocket}`}
            nodeId={nodeId}
            color={highlight.color}
            nombre={highlight.nombre}
            // Two people on the same box: side by side, not stacked on top.
            offset={index * 90}
          />
        )),
      )}
    </>
  )
}

export function RemotePresence({ highlights }: { highlights: RemoteHighlights }) {
  return (
    <ViewportPortal>
      <RemoteSelectionTags highlights={highlights} />
      <RemoteCursors />
    </ViewportPortal>
  )
}
