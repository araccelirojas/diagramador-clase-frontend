import { CircleHelp } from 'lucide-react'

import { useOnboarding } from '@/onboarding/useOnboarding'

export function GuideButton() {
  const { open } = useOnboarding()
  return (
    <button type="button" onClick={open} title="Volver a abrir la guía rápida" className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-sky-50 hover:text-sky-700">
      <CircleHelp className="h-3.5 w-3.5" />
      Guía
    </button>
  )
}
