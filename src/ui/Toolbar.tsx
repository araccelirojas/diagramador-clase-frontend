import { Download, Redo2, Undo2, Upload } from 'lucide-react'
import { useRef } from 'react'

import { deserializeDocument } from '@/io/deserialize'
import { downloadDocument, readDocumentFile } from '@/io/file'
import { setDocumentName } from '@/state/commands'
import { useDiagramStore } from '@/state/useDiagramStore'

/**
 * Development export / import (CLAUDE.md §2). These two buttons are the test
 * bench for the `contenido` format: the file they write is the exact object the
 * backend will store in phase 3.
 *
 * No localStorage autosave here. A snapshot of an old format cached in the
 * browser is a source of ghost bugs for the whole of phase 1.
 */

const BUTTON =
  'flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent'

export function Toolbar() {
  const fileInput = useRef<HTMLInputElement>(null)
  const name = useDiagramStore((state) => state.doc.meta.name)
  const dispatch = useDiagramStore((state) => state.dispatch)
  const undo = useDiagramStore((state) => state.undo)
  const redo = useDiagramStore((state) => state.redo)
  const canUndo = useDiagramStore((state) => state.history.past.length > 0)
  const canRedo = useDiagramStore((state) => state.history.future.length > 0)
  const nodeCount = useDiagramStore((state) => Object.keys(state.doc.nodes).length)

  const importFile = async (file: File): Promise<void> => {
    const state = useDiagramStore.getState()
    const result = deserializeDocument(await readDocumentFile(file))

    if (!result.ok) {
      state.setNotice([result.error, ...result.details].join(' · '))
      return
    }

    // Dirty on purpose: an import is an unsaved change with respect to the
    // backend, and without this the autosave sees a clean document and never
    // pushes the imported diagram to the cloud.
    state.replaceDocument(result.doc, { dirty: true })
    state.setNotice(`Se importó "${result.doc.meta.name}".`)
  }

  return (
    <>
      <span className="text-sm font-semibold">Diagramador UML</span>

      <input
        className="w-56 rounded-sm border border-transparent px-1.5 py-1 text-xs text-slate-700 hover:border-slate-300 focus:border-sky-500 focus:outline-none"
        value={name}
        aria-label="Nombre del modelo"
        onChange={(event) => dispatch(setDocumentName({ name: event.target.value }))}
      />

      <div className="flex items-center gap-1">
        <button type="button" onClick={undo} disabled={!canUndo} className={BUTTON} title="Ctrl+Z">
          <Undo2 className="h-3.5 w-3.5" />
          Deshacer
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          className={BUTTON}
          title="Ctrl+Shift+Z"
        >
          <Redo2 className="h-3.5 w-3.5" />
          Rehacer
        </button>
      </div>

      <div className="ml-2 flex items-center gap-1 border-l border-slate-200 pl-2">
        <button
          type="button"
          className={BUTTON}
          onClick={() => downloadDocument(useDiagramStore.getState().doc)}
        >
          <Download className="h-3.5 w-3.5" />
          Exportar JSON
        </button>
        <button type="button" className={BUTTON} onClick={() => fileInput.current?.click()}>
          <Upload className="h-3.5 w-3.5" />
          Importar JSON
        </button>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Reset so picking the same file twice fires the change event again.
          event.target.value = ''
          if (file) void importFile(file)
        }}
      />

      <span className="ml-auto text-xs text-slate-400">
        {nodeCount} {nodeCount === 1 ? 'elemento' : 'elementos'}
      </span>
    </>
  )
}
