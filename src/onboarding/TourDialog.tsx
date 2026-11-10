import { useEffect, useRef, type ReactNode } from 'react'

/** Only welcome and completion are modal; the actual spotlight leaves controls usable. */
export function TourDialog({ children }: { children: ReactNode }) {
  const card = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previousFocus = document.activeElement
    const element = card.current
    if (!element) return
    element.querySelector<HTMLButtonElement>('button')?.focus()
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const buttons = [...element.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')]
      const first = buttons[0]
      const last = buttons.at(-1)
      if (event.shiftKey && (document.activeElement === first || !element.contains(document.activeElement))) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) { event.preventDefault(); first?.focus() }
    }
    element.addEventListener('keydown', trap)
    return () => {
      element.removeEventListener('keydown', trap)
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])
  return (
    <div className="pointer-events-auto fixed inset-0 z-[10001] flex items-center justify-center overflow-y-auto bg-slate-900/30 p-4">
      <div ref={card} role="dialog" aria-modal="true" aria-labelledby="tour-modal-title" aria-describedby="tour-modal-description" className="max-h-[calc(100dvh-32px)] w-full max-w-md overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 text-slate-800 shadow-xl">{children}</div>
    </div>
  )
}
