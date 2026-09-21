import { describe, expect, it } from 'vitest'

import { createDocument, createNode, createProperty } from '@/uml/model/factories'
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
    // Version 0 never existed, so no migration is registered for it. Asserting
    // with SCHEMA_VERSION - 1 stopped working the moment that step got a real
    // migration, which is the point: this checks the gap, not the latest step.
    expect(() => migrate({ schemaVersion: 0 })).toThrow(/Falta la migración/)
  })
})

describe('migrate 1 -> 2 (associationId)', () => {
  /** A version 1 document: nodes had no `associationId` at all. */
  function v1Document() {
    const doc = createDocument({ now: '2026-09-10T14:00:00.000Z' }) as Record<string, unknown>
    const { associationId: _dropped, ...node } = createNode({
      id: 'n_a',
      kind: 'class',
      name: 'Estudiante',
      position: { x: 0, y: 0 },
      compartmentIds: ['attributes', 'operations'],
    })

    return { ...doc, schemaVersion: 1, nodes: { n_a: node } }
  }

  it('adds associationId: null to every node', () => {
    const migrated = migrate(v1Document())
    const nodes = migrated.nodes as Record<string, { associationId: unknown }>

    expect(nodes.n_a?.associationId).toBe(null)
  })

  it('bumps the version and still validates', () => {
    const migrated = migrate(v1Document())

    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION)
    expect(umlDocumentSchema.safeParse(migrated).success).toBe(true)
  })

  it('does not overwrite a value that is already there', () => {
    const doc = v1Document()
    const nodes = doc.nodes as Record<string, Record<string, unknown>>
    nodes.n_a = { ...nodes.n_a, associationId: 'e_1' }

    const migrated = migrate(doc)
    const migratedNodes = migrated.nodes as Record<string, { associationId: unknown }>

    expect(migratedNodes.n_a?.associationId).toBe('e_1')
  })
})

describe('migrate 2 -> 3 (isId)', () => {
  /** Un documento de la versión 2: las propiedades no tenían `isId`. */
  function v2Document() {
    const doc = createDocument({ now: '2026-09-10T14:00:00.000Z' }) as Record<string, unknown>
    const node = createNode({
      id: 'n_a',
      kind: 'class',
      name: 'Estudiante',
      position: { x: 0, y: 0 },
      compartmentIds: ['attributes', 'operations'],
    })

    const { isId: _fuera, ...propiedad } = createProperty({ id: 'm_1', name: 'dni' })
    node.compartments.attributes = [propiedad as never]

    return { ...doc, schemaVersion: 2, nodes: { n_a: node } }
  }

  it('pone isId en false en cada propiedad', () => {
    const migrado = migrate(v2Document())
    const nodos = migrado.nodes as Record<string, { compartments: Record<string, { isId: unknown }[]> }>

    expect(nodos.n_a?.compartments.attributes?.[0]?.isId).toBe(false)
  })

  it('sube la versión y sigue validando', () => {
    const migrado = migrate(v2Document())

    expect(migrado.schemaVersion).toBe(SCHEMA_VERSION)
    expect(umlDocumentSchema.safeParse(migrado).success).toBe(true)
  })

  it('no pisa una clave ya marcada', () => {
    const doc = v2Document()
    const nodos = doc.nodes as Record<string, { compartments: Record<string, unknown[]> }>
    const atributos = nodos.n_a!.compartments.attributes!
    atributos[0] = { ...(atributos[0] as object), isId: true }

    const migrado = migrate(doc)
    const salida = migrado.nodes as Record<string, { compartments: Record<string, { isId: unknown }[]> }>

    expect(salida.n_a?.compartments.attributes?.[0]?.isId).toBe(true)
  })

  it('encadena desde la versión 1 sin escalones', () => {
    const v1 = { ...(v2Document() as Record<string, unknown>), schemaVersion: 1 }

    expect(migrate(v1).schemaVersion).toBe(SCHEMA_VERSION)
  })
})
