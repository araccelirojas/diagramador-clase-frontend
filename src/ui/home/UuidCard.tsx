import { Check, Copy, Fingerprint } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/**
 * The session user's own UUID, ready to be handed to someone else.
 *
 * Without this the invite dialog is unusable: it asks for a UUID that nobody
 * has any way of knowing, not even their own. Showing it is what closes the
 * loop — you copy yours, send it to the project owner, and they can invite you.
 *
 * The id lives in a readonly input rather than in a `<p>` on purpose: when the
 * clipboard is unavailable (an insecure origin, a browser that refuses without
 * a gesture it recognises) the text can still be selected and copied by hand.
 */

const COPIED_MS = 2000

export function UuidCard({ idUsuario }: { idUsuario: string }) {
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!copied) return

    const timer = window.setTimeout(() => setCopied(false), COPIED_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(idUsuario)
      setCopied(true)
    } catch {
      // Clipboard refused: select it so Ctrl+C still works, and say nothing
      // misleading by claiming it was copied.
      inputRef.current?.select()
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
        <Fingerprint className="h-3.5 w-3.5 text-slate-400" />
        Tu UUID — compartilo para que puedan invitarte a sus proyectos
      </p>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={idUsuario}
          readOnly
          aria-label="Tu UUID de usuario"
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs text-slate-700 outline-none focus:border-sky-500"
        />

        <button
          type="button"
          onClick={() => void copy()}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </>
          )}
        </button>
      </div>
    </div>
  )
}
