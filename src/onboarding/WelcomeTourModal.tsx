import { TourDialog } from '@/onboarding/TourDialog'
import { tourSteps } from '@/onboarding/tourSteps'

export function WelcomeTourModal({ name, start, skip, saving, error }: { name: string; start: () => void; skip: () => void; saving: boolean; error: string | null }) {
  return (
    <TourDialog>
      <p className="mb-2 text-[11px] font-semibold tracking-wide text-sky-700">Guía rápida · Paso 1 de {tourSteps.length}</p>
      <p className="mb-2 text-sm text-slate-600">¡Hola, {name}! <span aria-hidden="true">👋</span></p>
      <h2 id="tour-modal-title" className="mb-3 text-lg font-semibold">¡Bienvenido a Diagramador UML!</h2>
      <div id="tour-modal-description" className="space-y-2 text-sm leading-relaxed text-slate-600"><p>{tourSteps[0]?.description}</p><p>¿Quieres hacer un recorrido rápido por las funciones principales?</p></div>
      {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={start} disabled={saving} className="rounded-md bg-sky-600 px-4 py-2 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50">Comenzar recorrido</button><button type="button" onClick={skip} disabled={saving} className="rounded-md px-3 py-2 text-xs text-slate-600 hover:bg-slate-100">{saving ? 'Guardando…' : 'Omitir'}</button></div>
      <button type="button" onClick={skip} disabled={saving} className="mt-3 text-[11px] text-slate-500 hover:text-sky-700">Saltar recorrido</button>
    </TourDialog>
  )
}
