import { apiFetch } from '@/api/client'
import type { Boceto } from '@/io/sketch'

/** `/api/boceto/*`. */

export type LecturaBoceto = {
  boceto: Boceto
  /** Tokens que costó la lectura, o null si OpenAI no los informó. */
  uso: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null
}

/**
 * Manda la imagen al backend, que se la pasa al modelo de visión.
 *
 * Devuelve lo LEÍDO, no un documento: convertirlo es trabajo de `io/sketch.ts`, donde vive
 * el contrato del modelo UML.
 */
export function interpretSketch(imagen: File, signal?: AbortSignal): Promise<LecturaBoceto> {
  const cuerpo = new FormData()
  cuerpo.append('imagen', imagen)

  return apiFetch<LecturaBoceto>('/boceto/interpretar', {
    method: 'POST',
    body: cuerpo,
    signal,
  })
}
