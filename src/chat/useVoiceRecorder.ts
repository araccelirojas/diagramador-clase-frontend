import { useCallback, useEffect, useRef, useState } from 'react'

import { usePresenceStore } from '@/sync/usePresenceStore'

/**
 * Records one voice note with MediaRecorder (CU-03).
 *
 * The refs hold browser resources (the recorder, the microphone stream), not a
 * copy of any store state, which is what CLAUDE.md §6.1 forbids.
 *
 * While recording, the room sees this person as "grabando" (CU-01).
 */

/** Shorter than this is a tap, not a note. */
export const MIN_NOTE_MS = 700
/** Matches the backend's AUDIO_MAX_MS: past this the note is finished and sent. */
export const MAX_NOTE_MS = 120_000

const TICK_MS = 200

/** What the browser can record, best first. Safari records mp4, the rest webm/opus. */
function pickMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return candidates.find((type) => MediaRecorder.isTypeSupported(type))
}

export type RecordedNote = { audio: Blob; durationMs: number }

export type VoiceRecorder = {
  status: 'idle' | 'starting' | 'recording'
  elapsedMs: number
  error: string | null
  start: () => Promise<void>
  /** Stops and returns the note, or null if it was too short or never started. */
  finish: () => Promise<RecordedNote | null>
  cancel: () => void
}

export function useVoiceRecorder(): VoiceRecorder {
  const [status, setStatus] = useState<VoiceRecorder['status']>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  /** Released before the microphone was even granted: drop it as soon as it is. */
  const abortedRef = useRef(false)

  const setRecording = usePresenceStore((state) => state.setRecording)

  useEffect(() => {
    setRecording('nota-de-voz', status !== 'idle')
  }, [status, setRecording])

  useEffect(() => {
    if (status !== 'recording') return
    const timer = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), TICK_MS)
    return () => clearInterval(timer)
  }, [status])

  const release = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) track.stop()
    streamRef.current = null
    recorderRef.current = null
    chunksRef.current = []
    setStatus('idle')
    setElapsedMs(0)
  }, [])

  const start = useCallback(async () => {
    if (recorderRef.current || status !== 'idle') return

    setError(null)
    abortedRef.current = false

    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no puede grabar audio.')
      return
    }

    setStatus('starting')

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('No hay permiso para usar el micrófono.')
      setStatus('idle')
      return
    }

    if (abortedRef.current) {
      for (const track of stream.getTracks()) track.stop()
      setStatus('idle')
      return
    }

    const mimeType = pickMimeType()
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    chunksRef.current = []
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    })

    streamRef.current = stream
    recorderRef.current = recorder
    startedAtRef.current = Date.now()
    recorder.start()
    setStatus('recording')
  }, [status])

  const finish = useCallback(async (): Promise<RecordedNote | null> => {
    const recorder = recorderRef.current
    if (!recorder) {
      abortedRef.current = true
      return null
    }

    // Measured here, not read from the file: Chrome writes webm without a duration,
    // and the player would show "Infinity".
    const durationMs = Date.now() - startedAtRef.current

    const stopped = new Promise<void>((resolve) => recorder.addEventListener('stop', () => resolve(), { once: true }))
    recorder.stop()
    await stopped

    const audio = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
    release()

    if (durationMs < MIN_NOTE_MS || audio.size === 0) return null
    return { audio, durationMs: Math.min(durationMs, MAX_NOTE_MS) }
  }, [release])

  const cancel = useCallback(() => {
    abortedRef.current = true
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    release()
  }, [release])

  // Leaving the editor mid-recording must free the microphone.
  useEffect(() => () => cancel(), [cancel])

  return { status, elapsedMs, error, start, finish, cancel }
}
