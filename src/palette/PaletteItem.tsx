import type { LucideIcon } from 'lucide-react'
import type { DragEvent } from 'react'

import {
  PALETTE_MIME,
  serializePaletteDrag,
  type PaletteDragPayload,
} from '@/canvas/interaction/usePaletteDrop'

type PaletteItemProps = {
  label: string
  icon: LucideIcon
  isActive: boolean
  onSelect: () => void
  /** Given only for tools that can be dropped onto the canvas or onto a node. */
  drag?: PaletteDragPayload
  hint: string
}

const BASE =
  'flex w-full items-center gap-2 rounded-sm border px-2 py-1.5 text-left text-[12px] transition-colors'
const IDLE = 'border-transparent text-slate-700 hover:border-slate-300 hover:bg-slate-50'
const ACTIVE = 'border-sky-400 bg-sky-50 text-sky-900'

export function PaletteItem({ label, icon: Icon, isActive, onSelect, drag, hint }: PaletteItemProps) {
  const onDragStart = (event: DragEvent<HTMLButtonElement>): void => {
    if (!drag) return

    event.dataTransfer.setData(PALETTE_MIME, serializePaletteDrag(drag))
    event.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <button
      type="button"
      draggable={drag !== undefined}
      onDragStart={onDragStart}
      onClick={onSelect}
      className={`${BASE} ${isActive ? ACTIVE : IDLE} ${drag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
      title={`${label} — ${hint}`}
    >
      <Icon className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={1.75} />
      <span className="truncate">{label}</span>
    </button>
  )
}
