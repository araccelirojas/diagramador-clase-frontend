import { useInternalNode, useStore, ViewportPortal } from '@xyflow/react'

import { PROVISIONAL_COLOR, type ProvisionalMarks } from '@/state/selectors'

/**
 * A tag over every box the AI changed while the room votes on it (CU-04). The
 * dashed outline is in `selectors.ts`; this only says what it means.
 *
 * Top-RIGHT of the box, so it does not cover the name tags of other people's
 * selections, which sit top-left. Same world-coordinates trick as
 * `RemotePresence`: inside the viewport, counter-scaled to stay readable.
 */

const zoomSelector = (state: { transform: [number, number, number] }) => state.transform[2]

function Tag({ nodeId }: { nodeId: string }) {
  const zoom = useStore(zoomSelector)
  const node = useInternalNode(nodeId)
  if (!node) return null

  const { x, y } = node.internals.positionAbsolute
  const width = node.measured.width ?? 0

  return (
    <div
      className="pointer-events-none absolute top-0 left-0"
      style={{
        transform: `translate(${x + width + 6}px, ${y - 6}px) scale(${1 / zoom}) translate(-100%, -100%)`,
        transformOrigin: '0 0',
        zIndex: 998,
      }}
    >
      <span
        className="block rounded-sm px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-white shadow-sm"
        style={{ backgroundColor: PROVISIONAL_COLOR }}
      >
        IA · en votación
      </span>
    </div>
  )
}

export function ProvisionalTags({ marks }: { marks: ProvisionalMarks }) {
  if (marks.nodes.size === 0) return null

  return (
    <ViewportPortal>
      {[...marks.nodes].map((id) => (
        <Tag key={id} nodeId={id} />
      ))}
    </ViewportPortal>
  )
}
