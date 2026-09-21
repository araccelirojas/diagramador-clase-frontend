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

/**
 * 1 -> 2: nodes gained `associationId`, the link an association class holds to
 * the relation it belongs to. Every node saved before this is an ordinary one,
 * so the field is simply null.
 */
const migrateNodesToAssociationId: Migration = (doc) => {
  const nodes = doc.nodes

  if (typeof nodes !== 'object' || nodes === null || Array.isArray(nodes)) {
    // Malformed: leave it be and let zod produce the readable error (§10.5).
    return { ...doc, schemaVersion: 2 }
  }

  const migrated: Record<string, unknown> = {}

  for (const [id, node] of Object.entries(nodes as Record<string, unknown>)) {
    migrated[id] =
      typeof node === 'object' && node !== null && !Array.isArray(node)
        ? { associationId: null, ...(node as Record<string, unknown>) }
        : node
  }

  return { ...doc, schemaVersion: 2, nodes: migrated }
}

/**
 * 2 -> 3: las propiedades ganaron `isId`, el modificador `{id}` de UML 2.5.
 *
 * Todo lo guardado antes se exportaba con una clave técnica impuesta por el generador, así
 * que ninguna propiedad era la identidad: el valor correcto es false en todas. Quien quiera
 * una clave natural la marca en el diagrama.
 */
const migratePropertiesToIsId: Migration = (doc) => {
  const nodes = doc.nodes

  if (typeof nodes !== 'object' || nodes === null || Array.isArray(nodes)) {
    return { ...doc, schemaVersion: 3 }
  }

  const migrated: Record<string, unknown> = {}

  for (const [id, node] of Object.entries(nodes as Record<string, unknown>)) {
    if (typeof node !== 'object' || node === null || Array.isArray(node)) {
      migrated[id] = node
      continue
    }

    const nodo = node as Record<string, unknown>
    const compartimentos = nodo.compartments

    if (typeof compartimentos !== 'object' || compartimentos === null) {
      migrated[id] = nodo
      continue
    }

    const nuevos: Record<string, unknown> = {}

    for (const [clave, miembros] of Object.entries(compartimentos as Record<string, unknown>)) {
      nuevos[clave] = Array.isArray(miembros)
        ? miembros.map((miembro) =>
            typeof miembro === 'object' &&
            miembro !== null &&
            (miembro as { kind?: unknown }).kind === 'property'
              ? { isId: false, ...(miembro as Record<string, unknown>) }
              : miembro,
          )
        : miembros
    }

    migrated[id] = { ...nodo, compartments: nuevos }
  }

  return { ...doc, schemaVersion: 3, nodes: migrated }
}

const MIGRATIONS: Record<number, Migration> = {
  1: migrateNodesToAssociationId,
  2: migratePropertiesToIsId,
}

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
