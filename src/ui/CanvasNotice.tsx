import { useEffect } from 'react'

import { useDiagramStore } from '@/state/useDiagramStore'

const VISIBLE_MS = 5000

/**
 * Transient explanation over the canvas: why a connection was refused, mostly.
 * Ephemeral view state, never part of the document.
 *
 * Visibility is derived from the store, not mirrored in local state: the effect
 * only owns the timer, and clearing it is a normal store update.
 */
export function CanvasNotice() {
  const notice = useDiagramStore((state) => state.notice)
  const setNotice = useDiagramStore((state) => state.setNotice)

  useEffect(() => {
    if (!notice) return

    const timer = window.setTimeout(() => setNotice(null), VISIBLE_MS)
    return () => window.clearTimeout(timer)
    // `at` is what makes the same message twice in a row restart the timer.
  }, [notice, setNotice])

  if (!notice) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center">
      <div className="pointer-events-auto flex max-w-lg items-start gap-3 rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-900 shadow-sm">
        <span>{notice.text}</span>
        <button
          type="button"
          onClick={() => setNotice(null)}
          className="shrink-0 text-amber-500 hover:text-amber-800"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
