import type { Mensaje } from '@/api/types'

/**
 * Pure helpers for the room chat (CU-02): merging what arrives from the socket
 * and from the history endpoint into one ordered, duplicate-free list.
 *
 * The same message can land twice — the ack and the room broadcast, or a page
 * that overlaps what the socket already delivered — so every merge is keyed by
 * `idMensaje`.
 */

/**
 * "@IA" as a word of its own, anywhere. Not "@IAN", not "yo@ia.com". Must match
 * the backend's `ia/contexto.js`: the client attaches the diagram when this
 * says yes, the server answers when its own copy says yes.
 */
const AI_MENTION = /(^|[^\w@.])@ia(?![\w])/i

export function mentionsAI(text: string): boolean {
  return AI_MENTION.test(text)
}

/** Splits the text so "@IA" can be drawn as a mention. */
export function splitMentions(text: string): { text: string; mention: boolean }[] {
  const parts: { text: string; mention: boolean }[] = []
  const pattern = /@ia(?![\w])/gi
  let last = 0

  for (const match of text.matchAll(pattern)) {
    const index = match.index
    const before = index === 0 ? '' : text.charAt(index - 1)
    // Same rule as `mentionsAI`: "yo@ia.com" is not a mention.
    if (/[\w@.]/.test(before)) continue

    if (index > last) parts.push({ text: text.slice(last, index), mention: false })
    parts.push({ text: match[0], mention: true })
    last = index + match[0].length
  }

  if (last < text.length) parts.push({ text: text.slice(last), mention: false })
  return parts
}

function compare(a: Mensaje, b: Mensaje): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1
  return a.idMensaje < b.idMensaje ? -1 : a.idMensaje > b.idMensaje ? 1 : 0
}

/**
 * Adds or replaces one message, keeping chronological order. The common case —
 * the newest message — is an append, without re-sorting everything.
 */
export function insertMessage(list: readonly Mensaje[], message: Mensaje): Mensaje[] {
  const existing = list.findIndex((m) => m.idMensaje === message.idMensaje)

  if (existing >= 0) {
    const next = [...list]
    next[existing] = message
    return next
  }

  const last = list[list.length - 1]
  if (last === undefined || compare(last, message) <= 0) return [...list, message]

  return [...list, message].sort(compare)
}

/** Merges a whole page (older history, or a refresh after reconnecting). */
export function mergePage(list: readonly Mensaje[], page: readonly Mensaje[]): Mensaje[] {
  if (page.length === 0) return [...list]

  const byId = new Map(list.map((m) => [m.idMensaje, m]))
  for (const message of page) byId.set(message.idMensaje, message)

  return [...byId.values()].sort(compare)
}

/** Calendar day in the viewer's timezone, to put "Hoy" / "Ayer" separators. */
export function dayKey(iso: string): string {
  const date = new Date(iso)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export function dayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)

  if (dayKey(iso) === dayKey(now.toISOString())) return 'Hoy'
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return 'Ayer'

  return date.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

/** "Ana está escribiendo…", "Ana y Beto están grabando…", "Ana, Beto y 2 más …". */
export function typingLabel(
  names: readonly string[],
  verb: 'escribiendo' | 'grabando' = 'escribiendo',
): string | null {
  if (names.length === 0) return null
  if (names.length === 1) return `${names[0]} está ${verb}…`
  if (names.length === 2) return `${names[0]} y ${names[1]} están ${verb}…`

  return `${names[0]}, ${names[1]} y ${names.length - 2} más están ${verb}…`
}

/** 65_400 ms -> "1:05". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
