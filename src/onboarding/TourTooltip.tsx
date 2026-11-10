import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

import { placeTooltip, type TourRect } from '@/onboarding/tourGeometry'
import { tourSteps, type TourStep } from '@/onboarding/tourSteps'

export type TourControls = {
  previous: () => void
  next: () => void
  skip: () => void
  saving: boolean
  error: string | null
}

export function TourTooltip({ step, index, rect, previous, next, skip, saving, error }: TourControls & { step: TourStep; index: number; rect: TourRect }) {
  const card = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 320, height: 260 })
  useLayoutEffect(() => {
    const element = card.current
    if (!element) return
    element.focus({ preventScroll: true })
    const measure = () => {
      const { width, height } = element.getBoundingClientRect()
      setSize((old) => old.width === width && old.height === height ? old : { width, height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [step.id])
  const position = placeTooltip(rect, size, { width: window.innerWidth, height: window.innerHeight }, step.side)
  const arrow: CSSProperties = { position: 'absolute', width: 12, height: 12, transform: 'rotate(45deg)', background: 'white' }
  if (position.side === 'bottom') Object.assign(arrow, { top: -7, left: position.arrow - 6, borderLeft: '1px solid #cbd5e1', borderTop: '1px solid #cbd5e1' })
  if (position.side === 'top') Object.assign(arrow, { bottom: -7, left: position.arrow - 6, borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' })
  if (position.side === 'right') Object.assign(arrow, { left: -7, top: position.arrow - 6, borderLeft: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' })
  if (position.side === 'left') Object.assign(arrow, { right: -7, top: position.arrow - 6, borderRight: '1px solid #cbd5e1', borderTop: '1px solid #cbd5e1' })
  return (
    <div ref={card} role="dialog" aria-modal="false" aria-labelledby="tour-title" aria-describedby="tour-description" tabIndex={-1} data-onboarding-card className="pointer-events-auto fixed z-[10001] w-80 max-w-[calc(100vw-24px)] rounded-lg border border-slate-300 bg-white p-4 text-slate-800 shadow-xl outline-none" style={{ left: position.left, top: position.top }}>
      <span aria-hidden="true" style={arrow} />
      <div className="max-h-[calc(100dvh-64px)] overflow-y-auto">
        <p className="mb-2 text-[11px] font-semibold tracking-wide text-sky-700" aria-live="polite">Guía rápida · Paso {index + 1} de {tourSteps.length}</p>
        <h2 id="tour-title" className="mb-2 text-sm font-semibold">{step.title}</h2>
        <p id="tour-description" className="text-xs leading-relaxed text-slate-600">{step.description}</p>
        {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={previous} disabled={saving} className="rounded px-1 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50">← Anterior</button>
          <button type="button" onClick={next} disabled={saving} className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50">{saving ? 'Guardando…' : index === tourSteps.length - 1 ? 'Finalizar recorrido' : 'Siguiente →'}</button>
        </div>
        <button type="button" onClick={skip} disabled={saving} className="mt-2 block w-full rounded py-1 text-right text-[11px] text-slate-500 hover:text-sky-700 disabled:opacity-50">Saltar recorrido</button>
      </div>
    </div>
  )
}
