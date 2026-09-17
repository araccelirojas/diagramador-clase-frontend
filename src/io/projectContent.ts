import { deserializeValue, type DeserializeResult } from '@/io/deserialize'
import { createDocument } from '@/uml/model/factories'
import type { UmlDocument } from '@/uml/model/types'

/**
 * The backend's `contenido` column -> a document the store can hold.
 *
 * Prisma declares the column as `Json @default("{}")`, so every freshly created
 * project arrives as an empty object. That is not a corrupt document, it is an
 * empty one: validating it with zod would greet the user with "el documento no
 * tiene la forma esperada" the first time they open a project they just made.
 * Distinguishing the two cases is the whole point of this file.
 */

export type ProjectContentResult =
  | { ok: true; doc: UmlDocument; isEmpty: boolean }
  | { ok: false; error: string; details: string[] }

/** `{}`, `null` and `undefined` all mean "nobody has saved a diagram here yet". */
function isEmptyContent(contenido: unknown): boolean {
  if (contenido === null || contenido === undefined) return true

  return (
    typeof contenido === 'object' && !Array.isArray(contenido) && Object.keys(contenido).length === 0
  )
}

export function documentFromProjectContent(
  contenido: unknown,
  nombreProyecto: string,
): ProjectContentResult {
  if (isEmptyContent(contenido)) {
    // The blank canvas takes the project's name, so the toolbar is not showing
    // "Modelo sin título" for a project the user just named.
    return { ok: true, doc: createDocument({ name: nombreProyecto }), isEmpty: true }
  }

  const result: DeserializeResult = deserializeValue(contenido)

  if (!result.ok) return result

  return { ok: true, doc: result.doc, isEmpty: false }
}
