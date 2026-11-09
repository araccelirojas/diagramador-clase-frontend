import { describe, expect, it } from 'vitest'

import {
  NO_REMOTE_HIGHLIGHTS,
  selectRemoteHighlights,
  withRemoteEdgeHighlights,
  withRemoteNodeHighlights,
  type UmlFlowEdge,
  type UmlFlowNode,
} from '@/state/selectors'
import { participantColor, type Participant } from '@/sync/presence'

function participant(idSocket: string, overrides: Partial<Participant> = {}): Participant {
  return {
    idSocket,
    idUsuario: `u-${idSocket}`,
    nombre: idSocket.toUpperCase(),
    estado: 'conectado',
    seleccion: { nodos: [], aristas: [] },
    ...overrides,
  }
}

describe('selectRemoteHighlights', () => {
  it('collects what others selected, leaving out this client', () => {
    const highlights = selectRemoteHighlights(
      {
        me: participant('me', { seleccion: { nodos: ['n_1'], aristas: [] } }),
        ana: participant('ana', { seleccion: { nodos: ['n_1', 'n_2'], aristas: ['e_1'] } }),
      },
      'me',
    )

    expect(highlights.nodes.get('n_1')?.map((h) => h.nombre)).toEqual(['ANA'])
    expect(highlights.nodes.get('n_2')?.[0]?.color).toBe(participantColor('u-ana'))
    expect(highlights.edges.get('e_1')).toHaveLength(1)
  })

  it('ignores disconnected participants and returns the shared empty value', () => {
    const highlights = selectRemoteHighlights(
      { ana: participant('ana', { estado: 'desconectado', seleccion: { nodos: ['n_1'], aristas: [] } }) },
      'me',
    )

    expect(highlights).toBe(NO_REMOTE_HIGHLIGHTS)
  })
})

describe('decorating the React Flow arrays', () => {
  const node = { id: 'n_1', position: { x: 0, y: 0 }, data: {}, style: { width: 100 } } as unknown as UmlFlowNode
  const edge = { id: 'e_1', source: 'a', target: 'b', data: { separacion: 0 } } as unknown as UmlFlowEdge

  it('returns the very same arrays when nobody else selected anything', () => {
    const nodes = [node]
    const edges = [edge]

    expect(withRemoteNodeHighlights(nodes, NO_REMOTE_HIGHLIGHTS)).toBe(nodes)
    expect(withRemoteEdgeHighlights(edges, NO_REMOTE_HIGHLIGHTS)).toBe(edges)
  })

  it('rings a node once per person and keeps its own style', () => {
    const highlights = selectRemoteHighlights(
      {
        a: participant('a', { seleccion: { nodos: ['n_1'], aristas: [] } }),
        b: participant('b', { seleccion: { nodos: ['n_1'], aristas: [] } }),
      },
      null,
    )

    const [decorated] = withRemoteNodeHighlights([node], highlights)
    expect(decorated?.style?.width).toBe(100)
    expect(String(decorated?.style?.boxShadow).split(', ')).toHaveLength(2)
  })

  it('colors an edge with the first person who selected it', () => {
    const highlights = selectRemoteHighlights(
      { a: participant('a', { seleccion: { nodos: [], aristas: ['e_1'] } }) },
      null,
    )

    const [decorated] = withRemoteEdgeHighlights([edge], highlights)
    expect(decorated?.data?.remoteColor).toBe(participantColor('u-a'))
  })
})
