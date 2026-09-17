import { AlertTriangle, Check, Cloud, Loader2 } from 'lucide-react'

import { useDiagramStore } from '@/state/useDiagramStore'
import type { SaveState } from '@/sync/useAutosave'

/**
 * Tells the user where their work is. An autosave that fails quietly is worse
 * than no autosave: it buys trust it has not earned, and the user closes the
 * tab believing the diagram is safe.
 */

const HORA = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })

export function SaveStatus({ state }: { state: SaveState }) {
  const isDirty = useDiagramStore((store) => store.isDirty)

  if (state.kind === 'error') {
    return (
      <span
        title={state.message}
        className="flex items-center gap-1.5 text-xs text-red-600"
        role="status"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        No se pudo guardar
      </span>
    )
  }

  if (state.kind === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-400" role="status">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Guardando…
      </span>
    )
  }

  // Dirty but not writing yet: the next tick will pick it up, and so will
  // closing the editor.
  if (isDirty) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-400" role="status">
        <Cloud className="h-3.5 w-3.5" />
        Cambios sin guardar
      </span>
    )
  }

  if (state.kind === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-400" role="status">
        <Check className="h-3.5 w-3.5 text-emerald-500" />
        Guardado {HORA.format(state.at)}
      </span>
    )
  }

  return null
}
