import { AlertCircle, Check, History, Loader2, Save } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

import type { VersionResumen } from '@/api/types'
import { VersionPreviewModal } from '@/versions/VersionPreviewModal'
import { loadVersions, saveCurrentVersion, useVersionStore } from '@/versions/useVersionStore'
import { ORIGIN_LABEL, versionCounts, versionDate } from '@/versions/versionLabels'

/**
 * The diagram's history (CU-05): "Guardar versión" on top, and every version
 * below, newest first. Clicking one opens it read-only, with the option to
 * restore it.
 */

function SaveVersionForm() {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setSaving(true)
    setResult(null)
    // A name half-typed in the canvas only reaches the document on blur.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    try {
      const version = await saveCurrentVersion(name)
      setName('')
      setResult({ ok: true, text: `Guardada como versión ${version.numero}.` })
    } catch (error) {
      setResult({ ok: false, text: error instanceof Error ? error.message : 'No se pudo guardar.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-1.5 border-b border-slate-200 pb-3">
      <div className="flex gap-1.5">
        <input
          data-presence-ignore
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          placeholder="Nombre (opcional)"
          aria-label="Nombre de la versión"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-[13px] focus:border-sky-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={saving}
          className="flex shrink-0 items-center gap-1 rounded-md bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Guardar versión
        </button>
      </div>
      {result && (
        <p className={`flex items-center gap-1 text-[11px] ${result.ok ? 'text-emerald-700' : 'text-red-600'}`}>
          {result.ok ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
          {result.text}
        </p>
      )}
    </form>
  )
}

function VersionItem({ version, onOpen }: { version: VersionResumen; onOpen: () => void }) {
  const origin = ORIGIN_LABEL[version.origen]

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-slate-100"
      >
        <p className="flex items-center gap-1.5 text-[13px] text-slate-800">
          <span className="font-semibold tabular-nums">v{version.numero}</span>
          <span className="min-w-0 flex-1 truncate">{version.nombre ?? origin.label}</span>
          <span className={`shrink-0 rounded-full px-1.5 text-[10px] leading-4 font-medium ${origin.className}`}>
            {origin.label}
          </span>
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {versionDate(version.fecha)} · {version.usuario?.nombre ?? 'La sala'} · {versionCounts(version)}
        </p>
      </button>
    </li>
  )
}

export function VersionsPanel({ idProyecto }: { idProyecto: string }) {
  const versions = useVersionStore((state) => state.versions)
  const loaded = useVersionStore((state) => state.loaded)
  const loading = useVersionStore((state) => state.loading)
  const hasMore = useVersionStore((state) => state.hasMore)
  const error = useVersionStore((state) => state.error)
  const [open, setOpen] = useState<VersionResumen | null>(null)

  useEffect(() => {
    useVersionStore.getState().reset(idProyecto)
    const controller = new AbortController()
    void loadVersions(false, controller.signal)
    return () => controller.abort()
  }, [idProyecto])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <SaveVersionForm />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!loaded && (
          <p className="flex items-center justify-center gap-1.5 py-6 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Cargando el historial…
          </p>
        )}
        {error && (
          <p className="flex items-center gap-1.5 rounded-sm bg-red-50 px-2 py-1 text-[11px] text-red-700">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {error}
          </p>
        )}
        {loaded && versions.length === 0 && !error && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-xs text-slate-400">
            <History className="h-6 w-6" />
            <p>
              Todavía no hay versiones. Guardá una cuando quieras; también se guardan solas mientras editan, y
              cada vez que la sala conserva un cambio de la IA.
            </p>
          </div>
        )}

        <ul className="space-y-0.5">
          {versions.map((version) => (
            <VersionItem key={version.idVersion} version={version} onOpen={() => setOpen(version)} />
          ))}
        </ul>

        {hasMore && (
          <button
            type="button"
            onClick={() => void loadVersions(true)}
            disabled={loading}
            className="mx-auto mt-2 flex items-center gap-1 text-[11px] text-slate-500 hover:text-sky-700"
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            {loading ? 'Cargando…' : 'Ver versiones anteriores'}
          </button>
        )}
      </div>

      {open && <VersionPreviewModal version={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
