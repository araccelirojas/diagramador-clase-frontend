/**
 * Shared Tailwind classes for the UML box (CLAUDE.md §12).
 *
 * The look follows the UML 2.5 conventions, which are not the same as "ugly":
 * a sharp rectangle (no rounded corners, no drop shadow), a thin solid border,
 * compartments separated by a full-width line, the name centred and bold —
 * italic when abstract — and members left-aligned in a monospaced face so the
 * ` : ` of every signature lines up.
 */

export const NODE_BOX =
  'flex h-full w-full flex-col overflow-hidden border bg-white text-[11px] leading-tight'

export const NODE_BORDER_IDLE = 'border-slate-700'
export const NODE_BORDER_SELECTED = 'border-slate-700 ring-2 ring-sky-400'
/** Live feedback while dragging a connection (§9). */
export const NODE_BORDER_VALID = 'border-emerald-600 ring-2 ring-emerald-400'
export const NODE_BORDER_INVALID = 'border-rose-500 ring-2 ring-rose-300'
export const NODE_BORDER_PENDING = 'border-sky-600 ring-2 ring-sky-300'

export const NODE_HEADER = 'flex flex-col items-center gap-0.5 px-3 py-2'

export const NODE_KEYWORD = 'text-[10px] leading-none text-slate-500'

export const NODE_NAME = 'w-full text-center text-[13px] font-semibold text-slate-900'

export const NODE_NAME_ABSTRACT = 'italic'

export const COMPARTMENT = 'flex flex-col px-2 py-1'

export const COMPARTMENT_SEPARATOR = 'border-t border-slate-700'

/** An empty compartment is empty, but still occupies its band. */
export const COMPARTMENT_EMPTY = 'min-h-[14px]'

export const MEMBER_ROW =
  'truncate px-1 py-[1px] font-mono text-[11px] text-slate-800 hover:bg-sky-50'

export const MEMBER_STATIC = 'underline decoration-slate-500 underline-offset-2'

export const MEMBER_ABSTRACT = 'italic'

/**
 * `nodrag` and `nopan` are React Flow conventions: without them, typing inside
 * the node drags the node or pans the canvas.
 */
export const INLINE_INPUT =
  'nodrag nopan w-full rounded-xs border border-sky-400 bg-white px-1 py-0 text-inherit font-[inherit] outline-none'
