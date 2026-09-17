import type { ZodError } from 'zod'

import { DocumentVersionError, migrate } from '@/uml/model/migrations'
import { umlDocumentSchema } from '@/uml/model/schema'
import type { UmlDocument } from '@/uml/model/types'

/**
 * Canonical document -> store (CLAUDE.md §10.5).
 *
 * ALWAYS validates with zod. A `JSON.parse` followed by optimistic property
 * access turns a corrupt document into a blank screen with no explanation —
 * that was mistake number 4 of the previous project (§14).
 *
 * Order matters: parse, then migrate (which only looks at schemaVersion), then
 * validate against the current schema.
 */

export type DeserializeResult =
  | { ok: true; doc: UmlDocument }
  | { ok: false; error: string; details: string[] }

const MAX_DETAILS = 8

function describe(error: ZodError): string[] {
  return error.issues.slice(0, MAX_DETAILS).map((issue) => {
    const path = issue.path.join('.')
    return path === '' ? issue.message : `${path}: ${issue.message}`
  })
}

/**
 * The validating core, on an already-parsed value.
 *
 * The backend sends `contenido` as a JSON object, never as a string (§10), so
 * the project loader must not have to `JSON.stringify` it just to parse it back.
 */
export function deserializeValue(value: unknown): DeserializeResult {
  let migrated: unknown

  try {
    migrated = migrate(value)
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof DocumentVersionError
          ? error.message
          : 'No se pudo interpretar la versión del documento.',
      details: [],
    }
  }

  const result = umlDocumentSchema.safeParse(migrated)

  if (!result.success) {
    return {
      ok: false,
      error: 'El documento no tiene la forma esperada y no se abrió.',
      details: describe(result.error),
    }
  }

  return { ok: true, doc: result.data }
}

/** The .uml.json file path: parse, then the exact same validation. */
export function deserializeDocument(raw: string): DeserializeResult {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return {
      ok: false,
      error: 'El archivo no es JSON válido.',
      details: [],
    }
  }

  return deserializeValue(parsed)
}
