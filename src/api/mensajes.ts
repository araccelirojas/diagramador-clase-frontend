import { apiFetch, apiFetchBlob } from '@/api/client'
import type { Mensaje, PaginaMensajes } from '@/api/types'

/**
 * The room chat's history (CU-02). New messages arrive over the socket; this
 * only reads backwards, one page at a time.
 */

export const PAGE_SIZE = 30

/**
 * The page before `antesDe` (the oldest message the client already holds), or
 * the latest page without it.
 */
export function listMessages(
  idProyecto: string,
  options: { antesDe?: string | null; limite?: number; signal?: AbortSignal } = {},
): Promise<PaginaMensajes> {
  const query = new URLSearchParams({ limite: String(options.limite ?? PAGE_SIZE) })
  if (options.antesDe) query.set('antesDe', options.antesDe)

  return apiFetch<PaginaMensajes>(`/proyectos/${idProyecto}/mensajes?${query.toString()}`, {
    signal: options.signal,
  })
}

/**
 * Uploads a voice note (CU-03). It goes over HTTP and not the socket: a few
 * hundred KB of audio on the socket would hold up the cursors and the edits
 * behind it. The transcription, and the AI's reply when `paraIA`, arrive later
 * over the socket.
 */
export function sendVoiceNote(
  idProyecto: string,
  note: {
    audio: Blob
    idCliente: string
    duracionMs: number
    paraIA: boolean
    diagrama?: { resumen: string; contenido: unknown }
  },
): Promise<{ mensaje: Mensaje }> {
  const form = new FormData()
  const extension = note.audio.type.includes('mp4') ? 'm4a' : note.audio.type.includes('ogg') ? 'ogg' : 'webm'

  form.append('audio', note.audio, `nota.${extension}`)
  form.append('idCliente', note.idCliente)
  form.append('duracionMs', String(Math.round(note.duracionMs)))
  form.append('paraIA', String(note.paraIA))
  if (note.diagrama) form.append('diagrama', JSON.stringify(note.diagrama))

  return apiFetch<{ mensaje: Mensaje }>(`/proyectos/${idProyecto}/mensajes/voz`, {
    method: 'POST',
    body: form,
  })
}

/** The audio of a voice note. Authenticated, so an <audio src> cannot fetch it alone. */
export function fetchVoiceAudio(idProyecto: string, idMensaje: string): Promise<Blob> {
  return apiFetchBlob(`/proyectos/${idProyecto}/mensajes/${idMensaje}/audio`)
}
