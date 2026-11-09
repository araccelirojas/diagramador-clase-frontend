import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { VersionResumen } from '@/api/types'
import { serialize } from '@/io/serialize'
import { onStoreChange, useDiagramStore, type StoreChange } from '@/state/useDiagramStore'
import { createDocument, createNode } from '@/uml/model/factories'
import type { UmlDocument } from '@/uml/model/types'

vi.mock('@/api/versiones', () => ({
  listVersions: vi.fn(),
  saveVersion: vi.fn(),
  restoreVersion: vi.fn(),
}))

const api = await import('@/api/versiones')
const { insertVersion, loadVersions, restoreToVersion, saveCurrentVersion, useVersionStore } = await import(
  '@/versions/useVersionStore'
)

const summary = (numero: number, extra: Partial<VersionResumen> = {}): VersionResumen => ({
  idVersion: `v${numero}`,
  idProyecto: 'p1',
  numero,
  origen: 'MANUAL',
  nombre: null,
  clases: 1,
  relaciones: 0,
  fecha: '2026-11-07T10:00:00.000Z',
  usuario: null,
  ...extra,
})

function withClass(name: string): UmlDocument {
  const doc = createDocument({ name: 'Tienda' })
  const node = createNode({ id: `n_${name}`, kind: 'class', name, diagramId: doc.diagrams[0]!.id, position: { x: 0, y: 0 }, compartmentIds: ['attributes', 'operations'] })
  doc.nodes[node.id] = node
  return doc
}

beforeEach(() => {
  vi.clearAllMocks()
  useVersionStore.getState().reset('p1')
  useDiagramStore.getState().replaceDocument(withClass('Actual'))
})

describe('insertVersion', () => {
  it('keeps newest first and ignores a version it already has', () => {
    const list = [summary(5), summary(2)]
    expect(insertVersion(list, summary(4)).map((v) => v.numero)).toEqual([5, 4, 2])
    expect(insertVersion(list, summary(5))).toBe(list)
  })
})

describe('the store', () => {
  it('ignores a version of another project', () => {
    useVersionStore.getState().received(summary(1, { idProyecto: 'otro' }))
    expect(useVersionStore.getState().versions).toEqual([])
  })

  it('pages backwards from the oldest version it holds', async () => {
    vi.mocked(api.listVersions)
      .mockResolvedValueOnce({ versiones: [summary(9), summary(8)], hayMas: true })
      .mockResolvedValueOnce({ versiones: [summary(7)], hayMas: false })

    await loadVersions()
    await loadVersions(true)

    expect(vi.mocked(api.listVersions).mock.calls[1]![1]).toMatchObject({ antesDe: 8 })
    expect(useVersionStore.getState().versions.map((v) => v.numero)).toEqual([9, 8, 7])
    expect(useVersionStore.getState().hasMore).toBe(false)
  })

  it('saves what is on screen and lists it at once', async () => {
    vi.mocked(api.saveVersion).mockResolvedValue(summary(3))
    await saveCurrentVersion('  Entrega 1  ')

    const [, body] = vi.mocked(api.saveVersion).mock.calls[0]!
    expect(body.nombre).toBe('Entrega 1')
    expect((body.contenido as UmlDocument).nodes.n_Actual).toBeDefined()
    expect(useVersionStore.getState().versions[0]?.numero).toBe(3)
  })
})

describe('restoreToVersion', () => {
  it('sends the current diagram as backup, replaces the document and tells the room', async () => {
    const old = serialize(withClass('Vieja'))
    vi.mocked(api.restoreVersion).mockResolvedValue({
      version: { ...summary(2), contenido: old },
      respaldo: summary(6, { origen: 'RESTAURACION' }),
    })
    const changes: StoreChange[] = []
    const stop = onStoreChange((change) => changes.push(change))

    await restoreToVersion('v2')
    stop()

    const [, , current] = vi.mocked(api.restoreVersion).mock.calls[0]!
    expect((current as UmlDocument).nodes.n_Actual).toBeDefined()

    const doc = useDiagramStore.getState().doc
    expect(doc.nodes.n_Vieja).toBeDefined()
    expect(doc.nodes.n_Actual).toBeUndefined()
    expect(useDiagramStore.getState().isDirty).toBe(true)
    // A wholesale change: this is what useCollaboration broadcasts to the room.
    expect(changes.map((c) => c.kind)).toEqual(['document'])
    expect(useVersionStore.getState().versions[0]?.origen).toBe('RESTAURACION')
  })

  it('leaves the document untouched when the server refuses (a vote is open)', async () => {
    vi.mocked(api.restoreVersion).mockRejectedValue(new Error('Hay una votación abierta'))
    const before = useDiagramStore.getState().doc

    await expect(restoreToVersion('v2')).rejects.toThrow(/votación abierta/)
    expect(useDiagramStore.getState().doc).toBe(before)
  })

  it('does not open a version that does not pass validation', async () => {
    vi.mocked(api.restoreVersion).mockResolvedValue({
      version: { ...summary(2), contenido: { nodes: 'roto' } },
      respaldo: summary(6, { origen: 'RESTAURACION' }),
    })
    const before = useDiagramStore.getState().doc

    await expect(restoreToVersion('v2')).rejects.toThrow(/no se pudo abrir/)
    expect(useDiagramStore.getState().doc).toBe(before)
  })
})
