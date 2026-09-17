import type { UmlDocument } from '@/uml/model/types'

/**
 * Store -> canonical document (CLAUDE.md §10.1).
 *
 * This is almost the identity on purpose: the store state ALREADY is the save
 * format. It only refreshes `updatedAt`, so there is no translation layer that
 * can drift apart from what you see on screen.
 *
 * The very same object is what the backend will store in `contenido` and what
 * the .uml.json file contains. One format for everything.
 */
export function serialize(doc: UmlDocument, now: string = new Date().toISOString()): UmlDocument {
  return {
    ...doc,
    meta: { ...doc.meta, updatedAt: now },
  }
}

/** Pretty-printed so a diff of two exported files is readable. */
export function toJson(doc: UmlDocument, now?: string): string {
  return JSON.stringify(serialize(doc, now), null, 2)
}
