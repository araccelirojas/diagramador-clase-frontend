import { Download, FileCode2, FileUp, Redo2, Undo2, Upload } from 'lucide-react'
import { useRef } from 'react'

import { deserializeDocument } from '@/io/deserialize'
import { downloadDocument, downloadXmi, readDocumentFile } from '@/io/file'
import { documentFromXmi } from '@/io/xmi/importXmi'
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
  'flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-1 text-xs whitespace-nowrap text-slate-600 transition-colors hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent'

export function Toolbar() {
  const fileInput = useRef<HTMLInputElement>(null)
  const xmiInput = useRef<HTMLInputElement>(null)
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

  /**
   * Un .xmi de Enterprise Architect. A diferencia del JSON, casi nunca entra entero: trae
   * elementos que este editor no dibuja. Por eso los avisos se muestran en el mismo sitio
   * donde el usuario ya mira los mensajes, en vez de perderse.
   */
  const importXmiFile = async (file: File): Promise<void> => {
    const state = useDiagramStore.getState()
    const nombre = file.name.replace(/\.xmi$/i, '')
    const result = documentFromXmi(await readDocumentFile(file), nombre)

    if (!result.ok) {
      state.setNotice(result.error)
      return
    }

    // Dirty, por lo mismo que el JSON: para la nube es un cambio sin guardar.
    state.replaceDocument(result.doc, { dirty: true })

    const cuantas = Object.keys(result.doc.nodes).length
    state.setNotice(
      [`Se importaron ${cuantas} ${cuantas === 1 ? 'clase' : 'clases'} desde XMI.`, ...result.avisos].join(
        ' · ',
      ),
    )
  }

  return (
    <>
      <span className="text-sm font-semibold">Diagramador UML</span>

      <input
        className="w-32 min-w-0 shrink rounded-sm border border-transparent px-1.5 py-1 text-xs text-slate-700 hover:border-slate-300 focus:border-sky-500 focus:outline-none xl:w-56"
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
          title="Descargar el diagrama como .uml.json"
          onClick={() => downloadDocument(useDiagramStore.getState().doc)}
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Exportar JSON</span>
        </button>
        <button
          type="button"
          className={BUTTON}
          title="Importar un .uml.json"
          onClick={() => fileInput.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Importar JSON</span>
        </button>
      </div>

      <div className="ml-2 flex items-center gap-1 border-l border-slate-200 pl-2">
        <button
          type="button"
          className={BUTTON}
          title="Descargar como .xmi (XMI 2.1) para abrirlo en Enterprise Architect"
          onClick={() => downloadXmi(useDiagramStore.getState().doc)}
        >
          <FileCode2 className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Exportar XMI</span>
        </button>
        <button
          type="button"
          className={BUTTON}
          title="Importar un .xmi de Enterprise Architect"
          onClick={() => xmiInput.current?.click()}
        >
          <FileUp className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Importar XMI</span>
        </button>
      </div>

      <input
        ref={xmiInput}
        type="file"
        accept=".xmi,.xml,application/xml,text/xml"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void importXmiFile(file)
        }}
      />

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

      {/* Sin `ml-auto`: quien empuja hacia la derecha es el grupo de acciones de App.tsx.
          Tenerlo aquí dejaba los botones de la derecha fuera de la pantalla. */}
      <span className="hidden shrink-0 text-xs whitespace-nowrap text-slate-400 lg:inline">
        {nodeCount} {nodeCount === 1 ? 'elemento' : 'elementos'}
      </span>
    </>
  )
}
