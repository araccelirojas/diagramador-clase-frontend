import { describe, expect, it } from 'vitest'

import { documentFromProjectContent } from '@/io/projectContent'
import { serialize } from '@/io/serialize'
import { createFullSampleDocument } from '@/uml/model/fullSampleDocument'
import { SCHEMA_VERSION } from '@/uml/model/schema'

/**
 * The backend's `contenido` is the one input the editor does not control: it
 * comes from a column with `@default("{}")` and from whatever schema version
 * was current when it was last saved.
 */

const NOMBRE = 'Sistema de Matrículas'

describe('documentFromProjectContent', () => {
  it('treats a project that was never saved as an empty document, not as an error', () => {
    const result = documentFromProjectContent({}, NOMBRE)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.isEmpty).toBe(true)
    expect(result.doc.nodes).toEqual({})
    expect(result.doc.edges).toEqual({})
    expect(result.doc.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('names the blank document after the project', () => {
    const result = documentFromProjectContent({}, NOMBRE)

    expect(result.ok && result.doc.meta.name).toBe(NOMBRE)
  })

  it('accepts null and undefined the same way as {}', () => {
    expect(documentFromProjectContent(null, NOMBRE).ok).toBe(true)
    expect(documentFromProjectContent(undefined, NOMBRE).ok).toBe(true)
  })

  it('loads a saved diagram as the very same document that was serialized', () => {
    const original = serialize(createFullSampleDocument())

    // What the backend stores is a JSON object, so this is the round trip the
    // editor really does: no string in between.
    const contenido: unknown = JSON.parse(JSON.stringify(original))
    const result = documentFromProjectContent(contenido, NOMBRE)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.isEmpty).toBe(false)
    expect(result.doc).toEqual(original)
    // The saved name wins over the project's: it is part of the document.
    expect(result.doc.meta.name).toBe(original.meta.name)
  })

  it('reports a corrupt contenido instead of opening a blank canvas', () => {
    const result = documentFromProjectContent({ schemaVersion: SCHEMA_VERSION, nodes: 'nope' }, NOMBRE)

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.error).not.toBe('')
    expect(result.details.length).toBeGreaterThan(0)
  })

  it('rejects a contenido written by a newer version of the editor', () => {
    const futuro = { ...serialize(createFullSampleDocument()), schemaVersion: SCHEMA_VERSION + 1 }
    const result = documentFromProjectContent(futuro, NOMBRE)

    expect(result.ok).toBe(false)
  })
})
