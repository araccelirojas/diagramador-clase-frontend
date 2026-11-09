import { Mic, SendHorizontal, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { mentionsAI } from '@/chat/messages'
import { HoldToRecordButton, RecordingBar } from '@/chat/RecordingControls'
import { sendChatMessage, sendVoiceNote } from '@/chat/useChatStore'
import { MAX_NOTE_MS, useVoiceRecorder } from '@/chat/useVoiceRecorder'
import { usePresenceStore } from '@/sync/usePresenceStore'

/**
 * Where messages are typed or recorded (CU-02, CU-03).
 *
 * Text: Enter sends, Shift+Enter is a new line. Typing tells the room
 * "escribiendo…" through the CU-01 status, and the field is marked
 * `data-presence-ignore` so focusing it does not ALSO count as editing the
 * diagram.
 *
 * Voice: hold a microphone to record, release to send. Slide left or press Esc
 * to cancel. The violet microphone sends the note to the AI, which answers with
 * a voice note of its own.
 *
 * The draft is component state on purpose: it is not part of the document and
 * nobody else needs to see it.
 */

/** Stop counting as "escribiendo" this long after the last key. */
const TYPING_IDLE_MS = 3000
const MAX_HEIGHT_PX = 120
/** Sliding this far left while holding cancels the recording. */
const CANCEL_DISTANCE_PX = 80

export function ChatComposer() {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const setTyping = usePresenceStore((state) => state.setTyping)

  const recorder = useVoiceRecorder()
  /** The button being held, and whether that note is for the AI. */
  const [held, setHeld] = useState<{ paraIA: boolean } | null>(null)
  const [canceling, setCanceling] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  /** Where the press started, to measure the slide-to-cancel. A DOM gesture value. */
  const startXRef = useRef(0)

  // Restarted on every key; when it fires, the person stopped typing.
  useEffect(() => {
    if (text === '') {
      setTyping(false)
      return
    }

    setTyping(true)
    const timer = setTimeout(() => setTyping(false), TYPING_IDLE_MS)
    return () => clearTimeout(timer)
  }, [text, setTyping])

  useEffect(() => () => setTyping(false), [setTyping])

  // Grow with the text up to a few lines, then scroll inside.
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, MAX_HEIGHT_PX)}px`
  }, [text])

  /* Text ------------------------------------------------------------------ */

  const send = (): void => {
    if (text.trim() === '') return
    sendChatMessage(text)
    setText('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    // Not while an IME is composing: Enter there confirms the character.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send()
    }
  }

  const askAI = (): void => {
    if (!mentionsAI(text)) setText((current) => `@IA ${current}`)
    inputRef.current?.focus()
  }

  /* Voice ----------------------------------------------------------------- */

  const { finish, cancel, start } = recorder

  const finishAndSend = useCallback(
    async (paraIA: boolean) => {
      setHeld(null)
      setCanceling(false)
      const note = await finish()
      if (note) sendVoiceNote(note.audio, note.durationMs, paraIA)
      else setHint('Mantené presionado el micrófono mientras hablás.')
    },
    [finish],
  )

  const abort = useCallback(() => {
    setHeld(null)
    setCanceling(false)
    cancel()
  }, [cancel])

  const press = (paraIA: boolean, clientX: number): void => {
    startXRef.current = clientX
    setHeld({ paraIA })
    setCanceling(false)
    setHint(null)
    void start()
  }

  const move = (clientX: number): void => {
    if (held) setCanceling(startXRef.current - clientX > CANCEL_DISTANCE_PX)
  }

  const release = (): void => {
    if (!held) return
    if (canceling) abort()
    else void finishAndSend(held.paraIA)
  }

  // Esc cancels while holding.
  useEffect(() => {
    if (!held) return
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') abort()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [held, abort])

  // Two minutes is the limit: the note goes out on its own. Counted from the press,
  // so waiting for the microphone permission only makes the note shorter, never longer.
  useEffect(() => {
    if (!held) return
    const timer = setTimeout(() => void finishAndSend(held.paraIA), MAX_NOTE_MS)
    return () => clearTimeout(timer)
  }, [held, finishAndSend])

  const recording = held !== null || recorder.status !== 'idle'
  const asking = mentionsAI(text)
  const showSend = text.trim() !== '' && !recording

  return (
    <div data-presence-ignore className="border-t border-slate-200 pt-2">
      <div className="flex items-end gap-1.5">
        <button
          type="button"
          onClick={askAI}
          disabled={recording}
          title="Preguntarle a la IA por escrito (menciona @IA)"
          className={`shrink-0 rounded-md p-1.5 transition-colors disabled:opacity-40 ${
            asking ? 'bg-violet-100 text-violet-700' : 'text-slate-400 hover:bg-violet-50 hover:text-violet-600'
          }`}
        >
          <Sparkles className="h-4 w-4" />
        </button>

        {recording ? (
          <RecordingBar
            elapsedMs={recorder.elapsedMs}
            starting={recorder.status === 'starting'}
            canceling={canceling}
            paraIA={held?.paraIA ?? false}
          />
        ) : (
          <textarea
            ref={inputRef}
            value={text}
            rows={1}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => setTyping(false)}
            placeholder="Escribí un mensaje… (@IA para preguntarle)"
            aria-label="Mensaje para la sala"
            className="min-w-0 flex-1 resize-none rounded-md border border-slate-300 px-2 py-1.5 text-[13px] leading-snug focus:border-sky-500 focus:outline-none"
          />
        )}

        {showSend ? (
          <button
            type="button"
            onClick={send}
            title="Enviar (Enter)"
            aria-label="Enviar mensaje"
            className="shrink-0 rounded-md bg-sky-600 p-1.5 text-white transition-colors hover:bg-sky-700"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        ) : (
          <>
            <HoldToRecordButton
              paraIA={false}
              active={held?.paraIA === false}
              disabled={held?.paraIA === true}
              onPress={(x) => press(false, x)}
              onMove={move}
              onRelease={release}
              onAbort={abort}
            >
              <Mic className="h-4 w-4" />
            </HoldToRecordButton>
            <HoldToRecordButton
              paraIA
              active={held?.paraIA === true}
              disabled={held?.paraIA === false}
              onPress={(x) => press(true, x)}
              onMove={move}
              onRelease={release}
              onAbort={abort}
            >
              <Mic className="h-4 w-4" />
              <Sparkles className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5" />
            </HoldToRecordButton>
          </>
        )}
      </div>

      {(recorder.error ?? hint) && (
        <p className="mt-1 text-[11px] text-amber-700">{recorder.error ?? hint}</p>
      )}
      {asking && !recording && (
        <p className="mt-1 text-[11px] text-violet-600">
          La IA va a ver el diagrama tal como está en tu pantalla.
        </p>
      )}
    </div>
  )
}
