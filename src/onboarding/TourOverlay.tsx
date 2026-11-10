import { TourTooltip, type TourControls } from '@/onboarding/TourTooltip'
import { tourSteps, type TourStep } from '@/onboarding/tourSteps'
import { useTourTarget } from '@/onboarding/useTourTarget'

export function TourOverlay({ step, index, onMissing, ...controls }: TourControls & { step: TourStep; index: number; onMissing: () => void }) {
  const rect = useTourTarget(step.target, onMissing)
  if (!rect) return (
    <div role="status" className="pointer-events-auto fixed right-4 bottom-4 z-[10001] max-w-xs rounded-lg border border-slate-300 bg-white p-4 text-xs text-slate-600 shadow-lg">
      <p className="mb-2 text-[11px] font-semibold text-sky-700">Guía rápida · Paso {index + 1} de {tourSteps.length}</p>
      <p>Preparando el siguiente paso…</p>
      {controls.error && <p role="alert" className="mt-2 text-red-700">{controls.error}</p>}
      <div className="mt-2 flex justify-between gap-4"><button type="button" onClick={controls.previous} disabled={controls.saving}>← Anterior</button><button type="button" onClick={controls.skip} disabled={controls.saving}>Saltar recorrido</button></div>
    </div>
  )
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed z-[10000] rounded-md border-2 border-sky-500" style={{ ...rect, boxShadow: '0 0 0 9999px rgb(15 23 42 / 0.32), 0 0 0 4px rgb(14 165 233 / 0.18)' }} />
      <TourTooltip {...controls} step={step} index={index} rect={rect} />
    </>
  )
}
