import { Loader2, Pause, Play } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'

import type { Mensaje } from '@/api/types'
import { audioUrl } from '@/chat/audioCache'
import { formatDuration } from '@/chat/messages'
import { useChatStore } from '@/chat/useChatStore'

/**
 * A voice note in the chat (CU-03): play/pause, a progress bar to seek, the
 * duration, and the transcription underneath.
 *
 * The audio is only fetched on the first play (see `audioCache`). An AI voice
 * reply to a question this user asked plays by itself once, when it arrives.
 */

/** A note with no transcription after this long is not "being transcribed" anymore. */
const TRANSCRIBING_WINDOW_MS = 3 * 60_000

/** How long this note can still be "being transcribed", from the moment it is shown. */
function transcribingLeftMs(fecha: string): number {
  return TRANSCRIBING_WINDOW_MS - (Date.now() - new Date(fecha).getTime())
}

function Transcription({ message, onDark }: { message: Mensaje; onDark: boolean }) {
  const failed = useChatStore((state) => state.transcriptionErrors[message.idMensaje])
  const muted = onDark ? 'text-sky-100' : 'text-slate-400'

  // Read the clock once, on mount, and then let a timer say when the window closed:
  // a note whose transcription never arrived must not spin forever.
  const [recent, setRecent] = useState(() => transcribingLeftMs(message.fecha) > 0)
  useEffect(() => {
    if (!recent || message.transcripcion !== null) return
    const timer = setTimeout(() => setRecent(false), Math.max(0, transcribingLeftMs(message.fecha)))
    return () => clearTimeout(timer)
  }, [recent, message.transcripcion, message.fecha])

  if (message.transcripcion !== null) {
    return message.transcripcion === '' ? (
      <p className={`mt-1 text-[11px] italic ${muted}`}>(no se entiende nada en la nota)</p>
    ) : (
      <p className="mt-1 text-[12px] leading-snug break-words whitespace-pre-wrap opacity-90">
        {message.transcripcion}
      </p>
    )
  }

  if (failed || !recent) {
    return (
      <p className={`mt-1 text-[11px] italic ${muted}`} title={failed}>
        Sin transcripción
      </p>
    )
  }

  return (
    <p className={`mt-1 flex items-center gap-1 text-[11px] italic ${muted}`}>
      <Loader2 className="h-3 w-3 animate-spin" />
      Transcribiendo…
    </p>
  )
}

export function VoicePlayer({ message, onDark }: { message: Mensaje; onDark: boolean }) {
  const idProyecto = useChatStore((state) => state.idProyecto)
  const autoplay = useChatStore((state) => state.autoplay === message.idMensaje)

  const audioRef = useRef<HTMLAudioElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [fileDuration, setFileDuration] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  /** The recorded duration wins: Chrome's webm files report no duration at all. */
  const durationMs = message.duracionMs ?? (fileDuration === null ? null : fileDuration * 1000)

  const play = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || idProyecto === null) return

    setError(null)
    try {
      if (!audio.src) {
        setLoading(true)
        const url = await audioUrl(idProyecto, message.idMensaje)
        audio.src = url
        setSrc(url)
      }
      await audio.play()
    } catch {
      setError('No se pudo reproducir')
    } finally {
      setLoading(false)
    }
  }, [idProyecto, message.idMensaje])

  useEffect(() => {
    if (!autoplay) return
    useChatStore.getState().clearAutoplay()
    // The arrival of the reply is the external event this syncs with; playing goes
    // after the effect so its state updates are not part of this render. The
    // browser may block autoplay: then the button is still there.
    void Promise.resolve().then(play)
  }, [autoplay, play])

  const toggle = (): void => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) audio.pause()
    else void play()
  }

  const seek = (event: MouseEvent<HTMLDivElement>): void => {
    const audio = audioRef.current
    if (!audio || !src || durationMs === null) return

    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    audio.currentTime = (ratio * durationMs) / 1000
  }

  const progress = durationMs ? Math.min(1, (position * 1000) / durationMs) : 0
  const track = onDark ? 'bg-sky-400/60' : 'bg-slate-200'
  const fill = onDark ? 'bg-white' : message.autor === 'IA' ? 'bg-violet-500' : 'bg-sky-600'

  return (
    <div className="min-w-44">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pausar nota de voz' : 'Reproducir nota de voz'}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
            onDark ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : playing ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="ml-0.5 h-3.5 w-3.5" />
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div onClick={seek} className={`h-1.5 cursor-pointer overflow-hidden rounded-full ${track}`}>
            <div className={`h-full rounded-full ${fill}`} style={{ width: `${progress * 100}%` }} />
          </div>
          <span className={`text-[10px] tabular-nums ${onDark ? 'text-sky-100' : 'text-slate-500'}`}>
            {error ?? `${playing || position > 0 ? `${formatDuration(position * 1000)} / ` : ''}${
              durationMs === null ? '–:––' : formatDuration(durationMs)
            }`}
          </span>
        </div>
      </div>

      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setPosition(0)
        }}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration
          if (Number.isFinite(value)) setFileDuration(value)
        }}
      />

      <Transcription message={message} onDark={onDark} />
    </div>
  )
}
