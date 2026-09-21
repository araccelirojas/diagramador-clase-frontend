import { beforeEach, describe, expect, it } from 'vitest'

import { addEdge } from '@/state/commands'
import { selectFlowEdges } from '@/state/selectors'
import { useDiagramStore } from '@/state/useDiagramStore'
import { edgeGeometry } from '@/canvas/edges/geometry'
import { createEdge } from '@/uml/model/factories'
import { createSampleDocument } from '@/uml/model/sampleDocument'

/**
 * Dos clases unidas por más de una relación —"Start" y "Goal" entre Aeropuerto y Vuelo— se
 * dibujaban una encima de otra: parecían una sola línea y las multiplicidades se pisaban.
 */

const store = useDiagramStore

const CAJA_A = { x: 0, y: 0, width: 200, height: 80 }
const CAJA_B = { x: 0, y: 300, width: 200, height: 80 }

let origen: string
let destino: string

beforeEach(() => {
  // Sin las relaciones del ejemplo: si no, las que agrega cada test comparten par con ellas
  // y el reparto ya no empieza de cero.
  store.getState().replaceDocument({ ...createSampleDocument(), edges: {} })

  const doc = store.getState().doc
  const activo = store.getState().activeDiagramId
  const ids = Object.values(doc.nodes)
    .filter((n) => n.diagramId === activo)
    .map((n) => n.id)

  origen = ids[0]!
  destino = ids[1]!
})

const separacionDe = (id: string): number =>
  selectFlowEdges(store.getState()).find((e) => e.id === id)?.data?.separacion ?? NaN

const agregar = (source: string, target: string, id: string) => {
  const diagramId = store.getState().activeDiagramId
  store.getState().dispatch(addEdge({ edge: { ...createEdge({ kind: 'association', diagramId, source, target }), id } }))
}

describe('relaciones paralelas entre el mismo par de clases', () => {
  it('una sola relación no se desplaza', () => {
    agregar(origen, destino, 'e1')

    expect(separacionDe('e1')).toBe(0)
  })

  it('dos relaciones se apartan a lados opuestos', () => {
    agregar(origen, destino, 'e1')
    agregar(origen, destino, 'e2')

    const a = separacionDe('e1')
    const b = separacionDe('e2')

    expect(a).not.toBe(b)
    // Repartidas alrededor del eje: una a cada lado, no las dos corridas al mismo.
    expect(Math.sign(a)).toBe(-Math.sign(b))
    expect(a + b).toBeCloseTo(0)
  })

  it('y sus líneas se dibujan en sitios distintos', () => {
    agregar(origen, destino, 'e1')
    agregar(origen, destino, 'e2')

    const uno = edgeGeometry('straight', CAJA_A, CAJA_B, [], false, separacionDe('e1'))
    const otro = edgeGeometry('straight', CAJA_A, CAJA_B, [], false, separacionDe('e2'))

    // Lo que fallaba: dos trazos idénticos punto por punto.
    expect(uno.path).not.toBe(otro.path)
    expect(uno.middle).not.toEqual(otro.middle)
  })

  it('el par se toma sin dirección: A→B y B→A tampoco coinciden', () => {
    agregar(origen, destino, 'e1')
    agregar(destino, origen, 'e2')

    const ida = edgeGeometry('straight', CAJA_A, CAJA_B, [], false, separacionDe('e1'))
    // La inversa recorre el mismo eje al revés, así que se le pasan las cajas cambiadas.
    const vuelta = edgeGeometry('straight', CAJA_B, CAJA_A, [], false, separacionDe('e2'))

    expect(ida.middle).not.toEqual(vuelta.middle)
  })

  it('dos bucles sobre la misma clase se agrandan en vez de superponerse', () => {
    agregar(origen, origen, 'e1')
    agregar(origen, origen, 'e2')

    const uno = edgeGeometry('straight', CAJA_A, CAJA_A, [], true, separacionDe('e1'))
    const otro = edgeGeometry('straight', CAJA_A, CAJA_A, [], true, separacionDe('e2'))

    expect(separacionDe('e1')).toBeGreaterThanOrEqual(0)
    expect(separacionDe('e2')).toBeGreaterThan(separacionDe('e1'))
    expect(uno.path).not.toBe(otro.path)
  })
})
