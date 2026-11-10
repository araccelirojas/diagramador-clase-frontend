import type { TourControls } from '@/onboarding/TourTooltip'
import { LAST_HOME_STEP, tourSteps } from '@/onboarding/tourSteps'

/** Keeps normal project creation/opening available while the tour waits. */
export function TourBridge({ previous, skip, saving, error }: Omit<TourControls, 'next'>) {
  return (
    <div role="dialog" aria-modal="false" aria-labelledby="tour-bridge-title" className="pointer-events-auto fixed right-4 bottom-4 z-[10001] w-80 max-w-[calc(100vw-32px)] rounded-lg border border-sky-200 bg-white p-4 text-slate-800 shadow-lg">
      <p className="mb-2 text-[11px] font-semibold text-sky-700">Guía rápida · Paso {LAST_HOME_STEP + 1} de {tourSteps.length}</p>
      <h2 id="tour-bridge-title" className="mb-2 text-sm font-semibold">Continuemos en tu diagrama</h2>
      <p className="text-xs leading-relaxed text-slate-600">Crea un proyecto con Nuevo proyecto o abre uno de tu lista. La guía continuará en el editor cuando entres.</p>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      <div className="mt-3 flex justify-between gap-2 text-xs"><button type="button" onClick={previous} disabled={saving} className="rounded p-1 text-slate-600 hover:bg-slate-100">← Anterior</button><button type="button" onClick={skip} disabled={saving} className="rounded p-1 text-slate-500 hover:text-sky-700">Saltar recorrido</button></div>
    </div>
  )
}
