import { TourDialog } from '@/onboarding/TourDialog'
import { MANUAL_URL } from '@/onboarding/tourSteps'

export function CompletionTourModal({ done, skip, saving, error }: { done: () => void; skip: () => void; saving: boolean; error: string | null }) {
  return (
    <TourDialog>
      <p className="mb-2 text-[11px] font-semibold tracking-wide text-sky-700">Guía rápida · Recorrido finalizado</p>
      <h2 id="tour-modal-title" className="mb-3 text-lg font-semibold">¡Listo! <span aria-hidden="true">🎉</span></h2>
      <p id="tour-modal-description" className="text-sm leading-relaxed text-slate-600">Ya conoces las principales herramientas de Diagramador UML. Puedes volver a este recorrido desde el botón Guía.</p>
      {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={done} disabled={saving} className="rounded-md bg-sky-600 px-4 py-2 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Empezar a diagramar'}</button>{MANUAL_URL && <a href={MANUAL_URL} target="_blank" rel="noopener noreferrer" className="rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">Abrir manual completo</a>}</div>
      <button type="button" onClick={skip} disabled={saving} className="mt-3 text-[11px] text-slate-500 hover:text-sky-700">Saltar recorrido</button>
    </TourDialog>
  )
}
