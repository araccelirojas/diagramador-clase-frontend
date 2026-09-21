import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

/**
 * The generic dialog of `ui/` (§4). Escape and a click on the backdrop close
 * it, because a modal you can only leave through one small button is a trap.
 *
 * It renders in place rather than in a portal: the app has no stacking context
 * that would clip it, and a portal would put it outside the React Flow
 * provider, which callers inside the canvas still need.
 */
export function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return

      // The canvas also listens for Escape to cancel its tool; while a dialog
      // is open the key belongs to the dialog.
      event.stopPropagation()
      onClose()
    }

    // Capture phase, so this runs before the canvas shortcut sees the key.
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-16"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-xl"
        // The click that closes belongs to the backdrop, not to the card.
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
            {description !== undefined && (
              <p className="mt-0.5 text-xs text-slate-500">{description}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-sm p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-4 py-3">{children}</div>
      </div>
    </div>
  )
}
