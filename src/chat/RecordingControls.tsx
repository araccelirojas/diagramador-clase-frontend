import { ChevronLeft, Loader2, Trash2 } from 'lucide-react'
import type { PointerEvent, ReactNode } from 'react'

import { formatDuration } from '@/chat/messages'
import { MAX_NOTE_MS } from '@/chat/useVoiceRecorder'

/**
 * The pieces of the hold-to-record gesture (CU-03).
 *
 * The button captures the pointer on press, so the release and the slide are
 * still its own even when the finger or the mouse wander off it — which is the
 * whole slide-to-cancel gesture.
 */

export function HoldToRecordButton({
  paraIA,
  active,
  disabled,
  onPress,
  onMove,
  onRelease,
  onAbort,
  children,
}: {
  paraIA: boolean
  active: boolean
  disabled: boolean
  onPress: (clientX: number) => void
  onMove: (clientX: number) => void
  onRelease: () => void
  onAbort: () => void
  children: ReactNode
}) {
  const label = paraIA
    ? 'Mantené presionado para preguntarle a la IA por voz'
    : 'Mantené presionado para grabar una nota de voz'

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0 || disabled) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    onPress(event.clientX)
  }

  const idle = paraIA
    ? 'text-violet-500 hover:bg-violet-50 hover:text-violet-700'
    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
  const pressed = paraIA ? 'scale-110 bg-violet-600 text-white' : 'scale-110 bg-red-500 text-white'

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerMove={(event) => active && onMove(event.clientX)}
      onPointerUp={() => active && onRelease()}
      onPointerCancel={() => active && onAbort()}
      // No menu on a long press on touch screens: the long press IS the gesture.
      onContextMenu={(event) => event.preventDefault()}
      className={`relative shrink-0 touch-none rounded-md p-1.5 transition select-none disabled:opacity-30 ${
        active ? pressed : idle
      }`}
    >
      {children}
    </button>
  )
}

export function RecordingBar({
  elapsedMs,
  starting,
  canceling,
  paraIA,
}: {
  elapsedMs: number
  starting: boolean
  canceling: boolean
  paraIA: boolean
}) {
  const remaining = MAX_NOTE_MS - elapsedMs

  return (
    <div
      role="status"
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-md border px-2 py-1.5 text-[12px] ${
        canceling ? 'border-slate-300 bg-slate-100 text-slate-500' : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      {starting ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Abriendo el micrófono…
        </>
      ) : canceling ? (
        <>
          <Trash2 className="h-3.5 w-3.5" />
          Soltá para cancelar
        </>
      ) : (
        <>
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500" />
          <span className="tabular-nums">{formatDuration(elapsedMs)}</span>
          {paraIA && <span className="text-violet-700">· para la IA</span>}
          <span className="ml-auto flex items-center gap-0.5 truncate text-[11px] text-slate-500">
            <ChevronLeft className="h-3 w-3" />
            {remaining < 15_000 ? `quedan ${Math.ceil(remaining / 1000)} s` : 'deslizá o Esc para cancelar'}
          </span>
        </>
      )}
    </div>
  )
}
