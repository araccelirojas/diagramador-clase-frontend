import { AlertCircle, Eye, History, Loader2, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ApiError } from '@/api/client'
import type { VersionResumen } from '@/api/types'
import { getVersion } from '@/api/versiones'
import { useVoteStore } from '@/ia/useVoteStore'
import { deserializeValue } from '@/io/deserialize'
import type { UmlDocument } from '@/uml/model/types'
import { Modal } from '@/ui/Modal'
import { DiagramPreview } from '@/versions/DiagramPreview'
import { restoreToVersion } from '@/versions/useVersionStore'
import { versionCounts, versionDate, versionTitle } from '@/versions/versionLabels'

/**
 * One version, read-only, with the way back to it (CU-05).
 *
 * Restoring asks first: it replaces the diagram for everyone in the room. What
 * is there now is not lost — the server keeps it as a version before handing
 * this one back — and the confirmation says so.
 */

type Loaded = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; doc: UmlDocument }

export function VersionPreviewModal({ version, onClose }: { version: VersionResumen; onClose: () => void }) {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' })
  const [confirming, setConfirming] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const voting = useVoteStore((state) => state.vote?.estado === 'abierta')

  useEffect(() => {
    const controller = new AbortController()
    getVersion(version.idVersion, controller.signal)
      .then((full) => {
        // The same validation and migration as opening a file: an old version
        // may be in an older schema.
        const result = deserializeValue(full.contenido)
        setLoaded(result.ok ? { status: 'ready', doc: result.doc } : { status: 'error', message: result.error })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoaded({
          status: 'error',
          message: error instanceof ApiError ? error.message : 'No se pudo cargar la versión.',
        })
      })
    return () => controller.abort()
  }, [version.idVersion])

  const restore = async (): Promise<void> => {
    setRestoring(true)
    setRestoreError(null)
    // A name half-typed in the canvas is not in the document until blur: let it
    // land, so the copy kept before restoring has it.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    try {
      await restoreToVersion(version.idVersion)
      onClose()
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : 'No se pudo restaurar la versión.')
      setRestoring(false)
    }
  }

  return (
    <Modal
      title={versionTitle(version)}
      description={`${versionDate(version.fecha)} · ${version.usuario?.nombre ?? 'La sala'} · ${versionCounts(version)}`}
      onClose={onClose}
      size="xl"
    >
      <div className="relative h-[60vh] overflow-hidden rounded-md border border-slate-200 bg-slate-50">
        {loaded.status === 'loading' && (
          <p className="flex h-full items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando la versión…
          </p>
        )}
        {loaded.status === 'error' && (
          <p className="flex h-full items-center justify-center gap-2 px-6 text-center text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {loaded.message}
          </p>
        )}
        {loaded.status === 'ready' && <DiagramPreview doc={loaded.doc} />}
        <span className="absolute top-2 left-2 flex items-center gap-1 rounded-sm bg-white/90 px-1.5 py-0.5 text-[11px] text-slate-500 shadow-xs">
          <Eye className="h-3 w-3" />
          Solo lectura
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {voting ? (
          <p className="flex items-center gap-1.5 text-xs text-violet-700">
            <History className="h-3.5 w-3.5" />
            No se puede restaurar mientras la sala vota un cambio de la IA.
          </p>
        ) : confirming ? (
          <>
            <p className="flex-1 text-xs text-slate-600">
              ¿Restaurar la versión {version.numero} para toda la sala? Lo que hay ahora se guarda antes como
              una versión nueva, así que se puede volver.
            </p>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={restoring}
              className="rounded-md px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void restore()}
              disabled={restoring}
              className="flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {restoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Sí, restaurar
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={loaded.status !== 'ready'}
            className="ml-auto flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar esta versión
          </button>
        )}
      </div>

      {restoreError && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {restoreError}
        </p>
      )}
    </Modal>
  )
}
