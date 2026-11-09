import { fetchVoiceAudio } from '@/api/mensajes'

/**
 * Voice note audio, fetched once per message and kept as an object URL (CU-03).
 *
 * The audio endpoint needs the session token, which an <audio src> cannot send,
 * so the bytes come through `fetch` and play from a blob URL. Lazily: only when
 * someone presses play, never for the whole history at once.
 */

const urls = new Map<string, Promise<string>>()

export function audioUrl(idProyecto: string, idMensaje: string): Promise<string> {
  const key = `${idProyecto}:${idMensaje}`
  const cached = urls.get(key)
  if (cached) return cached

  const promise = fetchVoiceAudio(idProyecto, idMensaje).then((blob) => URL.createObjectURL(blob))
  // A failed fetch must not stay cached: the next press tries again.
  promise.catch(() => urls.delete(key))
  urls.set(key, promise)
  return promise
}

/** Leaving the project: the blobs would otherwise live until the tab closes. */
export function clearAudioCache(): void {
  for (const promise of urls.values()) {
    void promise.then((url) => URL.revokeObjectURL(url)).catch(() => {})
  }
  urls.clear()
}
