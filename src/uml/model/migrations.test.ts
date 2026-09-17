import { describe, expect, it } from 'vitest'

import { createDocument } from '@/uml/model/factories'
import { DocumentVersionError, migrate } from '@/uml/model/migrations'
import { SCHEMA_VERSION, umlDocumentSchema } from '@/uml/model/schema'

describe('migrate', () => {
  it('leaves a current document untouched', () => {
    const doc = createDocument({ now: '2026-09-10T14:00:00.000Z' })

    expect(migrate(structuredClone(doc))).toEqual(doc)
  })

  it('still validates after migrating', () => {
    expect(umlDocumentSchema.safeParse(migrate(createDocument())).success).toBe(true)
  })

  it('rejects a document from a newer editor instead of trying to open it', () => {
    const doc = { ...createDocument(), schemaVersion: SCHEMA_VERSION + 1 }

    expect(() => migrate(doc)).toThrow(DocumentVersionError)
    expect(() => migrate(doc)).toThrow(/versión más nueva del editor/)
  })

  it('rejects a document with no schemaVersion', () => {
    expect(() => migrate({ kind: 'uml-class-model' })).toThrow(/schemaVersion/)
  })

  it('rejects anything that is not an object', () => {
    expect(() => migrate('[]')).toThrow(/no contiene un documento UML/)
    expect(() => migrate([])).toThrow(/no contiene un documento UML/)
    expect(() => migrate(null)).toThrow(/no contiene un documento UML/)
  })

  it('reports a missing migration instead of failing silently', () => {
    expect(() => migrate({ schemaVersion: SCHEMA_VERSION - 1 })).toThrow(/Falta la migración/)
  })
})
