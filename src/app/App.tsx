import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import type { ProyectoResumen } from '@/api/types'
import { UmlCanvas } from '@/canvas/UmlCanvas'
import { Inspector } from '@/inspector/Inspector'
import { Palette } from '@/palette/Palette'
import { SaveStatus } from '@/sync/SaveStatus'
import type { SaveState } from '@/sync/useAutosave'
import { Toolbar } from '@/ui/Toolbar'

/**
 * General layout: toolbar on top, palette | canvas | inspector below.
 * Holds no business logic; every zone reads what it needs from the store.
 *
 * `EditorPage` mounts it only once the project's document is already in the
 * store, so nothing here has to deal with loading or with a missing diagram.
 */
function App({ proyecto, saveState }: { proyecto: ProyectoResumen; saveState: SaveState }) {
  return (
    <div className="grid h-full grid-cols-[14rem_1fr_20rem] grid-rows-[3rem_1fr] bg-slate-100 text-slate-800">
      <header className="col-span-3 flex items-center gap-2 border-b border-slate-300 bg-white px-4">
        <Link
          to="/"
          title={`Proyecto: ${proyecto.nombre}`}
          className="flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Proyectos
        </Link>

        <span className="h-4 w-px shrink-0 bg-slate-200" />

        <Toolbar />

        <span className="h-4 w-px shrink-0 bg-slate-200" />
        <SaveStatus state={saveState} />
      </header>

      <aside className="overflow-y-auto border-r border-slate-300 bg-white p-3">
        <Palette />
      </aside>

      <main className="relative min-w-0 overflow-hidden">
        <UmlCanvas />
      </main>

      <aside className="overflow-y-auto border-l border-slate-300 bg-white p-3">
        <Inspector />
      </aside>
    </div>
  )
}

export default App
