import { describe, expect, it } from 'vitest'

import { deserializeDocument } from '@/io/deserialize'
import { fileNameFor } from '@/io/file'
import { serialize, toJson } from '@/io/serialize'
import { createDocument } from '@/uml/model/factories'
import { createFullSampleDocument } from '@/uml/model/fullSampleDocument'
import { SCHEMA_VERSION } from '@/uml/model/schema'
import { validateDocument } from '@/uml/model/validators'

const NOW = '2026-09-11T09:30:00.000Z'

/** Every key of the persisted JSON, at every depth. */
function collectKeys(value: unknown, keys: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys)
    return keys
  }

  if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key)
      collectKeys(child, keys)
    }
  }

  return keys
}

describe('round trip', () => {
  it('reproduces the document exactly', () => {
    const doc = createFullSampleDocument()
    const result = deserializeDocument(toJson(doc, NOW))

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Only updatedAt may differ, and only because serialize() stamps it.
    expect(result.doc).toEqual({ ...doc, meta: { ...doc.meta, updatedAt: NOW } })
  })

  it('reproduces an empty document', () => {
    const doc = createDocument({ now: NOW })
    const result = deserializeDocument(toJson(doc, NOW))

    expect(result.ok && result.doc).toEqual(doc)
  })

  /**
   * The contract is semantic equality, asserted above: key order is not
   * meaningful in JSON, and a freshly built document orders optional keys by
   * when they were assigned rather than by the schema. What does matter is that
   * the format has a fixed point, so re-saving a file that was opened produces
   * a byte-identical file and diffs of saved diagrams stay clean.
   */
  it('has a fixed point: re-exporting an imported document gives the same bytes', () => {
    const once = deserializeDocument(toJson(createFullSampleDocument(), NOW))
    expect(once.ok).toBe(true)
    if (!once.ok) return

    const json = toJson(once.doc, NOW)
    const twice = deserializeDocument(json)

    expect(twice.ok).toBe(true)
    if (!twice.ok) return

    expect(toJson(twice.doc, NOW)).toBe(json)
  })

  it('keeps the six relations and both classifiers', () => {
    const doc = createFullSampleDocument()
    const result = deserializeDocument(toJson(doc, NOW))

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(Object.values(result.doc.edges).map((edge) => edge.kind).sort()).toEqual([
      'aggregation',
      'association',
      'composition',
      'directed-association',
      'generalization',
      'realization',
    ])
    expect(new Set(Object.values(result.doc.nodes).map((node) => node.kind))).toEqual(
      new Set(['class', 'interface']),
    )
  })

  it('the reference document raises no warnings', () => {
    expect(validateDocument(createFullSampleDocument())).toEqual([])
  })

  // §5.1: every persisted key in English and ASCII. A single "ñ" in a key is a
  // silent encoding problem between browser, backend and database.
  it('uses only ASCII keys', () => {
    const offenders = [...collectKeys(JSON.parse(toJson(createFullSampleDocument(), NOW)))].filter(
      (key) => !/^[A-Za-z0-9_]+$/.test(key),
    )

    expect(offenders).toEqual([])
  })
})

describe('serialize', () => {
  it('only refreshes updatedAt', () => {
    const doc = createFullSampleDocument()
    const serialized = serialize(doc, NOW)

    expect(serialized).toEqual({ ...doc, meta: { ...doc.meta, updatedAt: NOW } })
    // Almost the identity: it does not touch the document it was given.
    expect(doc.meta.updatedAt).not.toBe(NOW)
  })
})

describe('deserialize rejects instead of opening a broken diagram', () => {
  it('refuses text that is not JSON', () => {
    const result = deserializeDocument('{ esto no es json')

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toMatch(/no es JSON válido/)
  })

  it('refuses a document from a newer editor', () => {
    const doc = { ...createDocument(), schemaVersion: SCHEMA_VERSION + 1 }
    const result = deserializeDocument(JSON.stringify(doc))

    expect(result.ok === false && result.error).toMatch(/versión más nueva del editor/)
  })

  it('refuses an edge pointing at a node that does not exist (§5.4.1)', () => {
    const doc = createFullSampleDocument()
    delete doc.nodes.n_curso

    const result = deserializeDocument(JSON.stringify(doc))

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.details.join(' ')).toMatch(/nodo inexistente/)
  })

  it('refuses a document with a repeated id (§5.4.3)', () => {
    const doc = createFullSampleDocument()
    doc.nodes.n_curso!.compartments.attributes = [
      { ...doc.nodes.n_persona!.compartments.attributes![0]! },
    ]

    const result = deserializeDocument(JSON.stringify(doc))

    expect(result.ok === false && result.details.join(' ')).toMatch(/está repetido/)
  })

  it('explains what is wrong instead of failing silently', () => {
    const result = deserializeDocument(JSON.stringify({ schemaVersion: 1, kind: 'uml-class-model' }))

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.details.length).toBeGreaterThan(0)
  })
})

describe('fileNameFor', () => {
  it('uses the model name', () => {
    const doc = createDocument({ name: 'Sistema de Matrículas' })

    expect(fileNameFor(doc)).toBe('Sistema-de-Matrículas.uml.json')
  })

  it('drops characters a file system rejects', () => {
    const doc = createDocument({ name: 'a/b:c*d?' })

    expect(fileNameFor(doc)).toBe('a-b-c-d-.uml.json')
  })
})
