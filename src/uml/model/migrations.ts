import { SCHEMA_VERSION } from '@/uml/model/schema'

/**
 * Schema migrations (CLAUDE.md §10.4). This file exists from the first commit
 * even though the only migration so far is the identity: when the format
 * changes mid-development, documents already saved must keep opening.
 *
 * To add one: write MIGRATIONS[N] returning the shape of version N + 1, bump
 * SCHEMA_VERSION, update the zod schema and the round-trip test. All four.
 */

export type RawDocument = Record<string, unknown>

/** Transforms a document of version N into one of version N + 1. */
export type Migration = (doc: RawDocument) => RawDocument

const MIGRATIONS: Record<number, Migration> = {}

export class DocumentVersionError extends Error {
  override name = 'DocumentVersionError'
}

function isRawDocument(value: unknown): value is RawDocument {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Brings a raw parsed document up to SCHEMA_VERSION. Runs before zod: it only
 * inspects `schemaVersion`, and validation of everything else comes after.
 */
export function migrate(raw: unknown): RawDocument {
  if (!isRawDocument(raw)) {
    throw new DocumentVersionError('El archivo no contiene un documento UML.')
  }

  const version = raw.schemaVersion

  if (typeof version !== 'number' || !Number.isInteger(version)) {
    throw new DocumentVersionError(
      'El documento no declara un "schemaVersion" válido y no se puede abrir.',
    )
  }

  if (version > SCHEMA_VERSION) {
    throw new DocumentVersionError(
      `El documento fue creado con una versión más nueva del editor (schemaVersion ${version}, ` +
        `soportada ${SCHEMA_VERSION}). Actualizá el editor para abrirlo.`,
    )
  }

  let current = raw
  let currentVersion = version

  while (currentVersion < SCHEMA_VERSION) {
    const migration = MIGRATIONS[currentVersion]

    if (!migration) {
      throw new DocumentVersionError(
        `Falta la migración de schemaVersion ${currentVersion} a ${currentVersion + 1}.`,
      )
    }

    current = migration(current)
    currentVersion += 1
  }

  return current
}
