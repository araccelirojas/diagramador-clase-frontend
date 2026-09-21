import type { RefinementCtx } from 'zod'

import type { UmlDocument, UmlNode } from '@/uml/model/types'

/**
 * The invariants of CLAUDE.md §5.4, checked by the document schema. A document
 * that breaks any of these is corrupt, not merely incomplete, so it gets
 * rejected with a readable message instead of opening into a blank screen.
 *
 * They live apart from the zod shapes so neither file grows past the size where
 * it stops being readable (§12).
 */

/** Node kind allowed to contain other nodes. */
const PACKAGE_KIND = 'package'

type IdEntry = { id: string; path: (string | number)[] }

/** Every id in the document, members and parameters included (§5.4.3). */
function collectIds(doc: UmlDocument): IdEntry[] {
  const ids: IdEntry[] = []

  doc.diagrams.forEach((diagram, index) => {
    ids.push({ id: diagram.id, path: ['diagrams', index, 'id'] })
  })

  for (const [key, node] of Object.entries(doc.nodes)) {
    ids.push({ id: node.id, path: ['nodes', key, 'id'] })

    for (const [compartmentId, members] of Object.entries(node.compartments)) {
      members.forEach((member, index) => {
        const memberPath = ['nodes', key, 'compartments', compartmentId, index]
        ids.push({ id: member.id, path: [...memberPath, 'id'] })

        if (member.kind === 'operation') {
          member.parameters.forEach((parameter, parameterIndex) => {
            ids.push({
              id: parameter.id,
              path: [...memberPath, 'parameters', parameterIndex, 'id'],
            })
          })
        }
      })
    }
  }

  for (const [key, edge] of Object.entries(doc.edges)) {
    ids.push({ id: edge.id, path: ['edges', key, 'id'] })
  }

  return ids
}

/** Walks up parentId looking for a containment cycle (§5.4.2). */
function hasParentCycle(nodes: Record<string, UmlNode>, start: UmlNode): boolean {
  const seen = new Set<string>([start.id])
  let current = start.parentId === null ? undefined : nodes[start.parentId]

  while (current) {
    if (seen.has(current.id)) return true
    seen.add(current.id)
    current = current.parentId === null ? undefined : nodes[current.parentId]
  }

  return false
}

function checkNodes(doc: UmlDocument, ctx: RefinementCtx, diagramIds: Set<string>): void {
  for (const [key, node] of Object.entries(doc.nodes)) {
    // The record key must match the element id, or every lookup silently disagrees.
    if (key !== node.id) {
      ctx.addIssue({
        code: 'custom',
        path: ['nodes', key, 'id'],
        message: `La clave "${key}" no coincide con el id del nodo "${node.id}".`,
      })
    }
    if (!diagramIds.has(node.diagramId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['nodes', key, 'diagramId'],
        message: `El nodo "${key}" apunta a un diagrama inexistente "${node.diagramId}".`,
      })
    }

    // §5.4.6 — an association class points at a relation that is really there,
    // and in its own diagram. A dangling pointer draws a dashed line to nowhere.
    if (node.associationId !== null) {
      const association = doc.edges[node.associationId]

      if (!association) {
        ctx.addIssue({
          code: 'custom',
          path: ['nodes', key, 'associationId'],
          message: `El nodo "${key}" es la clase de una relación inexistente "${node.associationId}".`,
        })
      } else if (association.diagramId !== node.diagramId) {
        ctx.addIssue({
          code: 'custom',
          path: ['nodes', key, 'associationId'],
          message: `El nodo "${key}" y su relación "${node.associationId}" están en diagramas distintos.`,
        })
      }
    }
  }
}

/** §5.4.1 — both endpoints exist and belong to the same diagram. */
function checkEdges(doc: UmlDocument, ctx: RefinementCtx, diagramIds: Set<string>): void {
  for (const [key, edge] of Object.entries(doc.edges)) {
    if (key !== edge.id) {
      ctx.addIssue({
        code: 'custom',
        path: ['edges', key, 'id'],
        message: `La clave "${key}" no coincide con el id de la arista "${edge.id}".`,
      })
    }
    if (!diagramIds.has(edge.diagramId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['edges', key, 'diagramId'],
        message: `La arista "${key}" apunta a un diagrama inexistente "${edge.diagramId}".`,
      })
    }

    for (const side of ['source', 'target'] as const) {
      const endpointId = edge[side]
      const endpoint = doc.nodes[endpointId]

      if (!endpoint) {
        ctx.addIssue({
          code: 'custom',
          path: ['edges', key, side],
          message: `La arista "${key}" referencia un nodo inexistente "${endpointId}".`,
        })
      } else if (endpoint.diagramId !== edge.diagramId) {
        ctx.addIssue({
          code: 'custom',
          path: ['edges', key, side],
          message: `La arista "${key}" cruza diagramas: el nodo "${endpointId}" está en "${endpoint.diagramId}".`,
        })
      }
    }
  }
}

/** §5.4.2 — parentId points to an existing package, without cycles. */
function checkContainment(doc: UmlDocument, ctx: RefinementCtx): void {
  for (const [key, node] of Object.entries(doc.nodes)) {
    if (node.parentId === null) continue

    const parent = doc.nodes[node.parentId]

    if (!parent) {
      ctx.addIssue({
        code: 'custom',
        path: ['nodes', key, 'parentId'],
        message: `El nodo "${key}" tiene como padre a un nodo inexistente "${node.parentId}".`,
      })
      continue
    }
    if (parent.kind !== PACKAGE_KIND) {
      ctx.addIssue({
        code: 'custom',
        path: ['nodes', key, 'parentId'],
        message: `El padre de "${key}" debe ser un paquete y es "${parent.kind}".`,
      })
    }
    if (hasParentCycle(doc.nodes, node)) {
      ctx.addIssue({
        code: 'custom',
        path: ['nodes', key, 'parentId'],
        message: `El nodo "${key}" forma un ciclo de contención.`,
      })
    }
  }
}

/** §5.4.3 — ids unique across the whole document. */
function checkUniqueIds(doc: UmlDocument, ctx: RefinementCtx): void {
  const seen = new Set<string>()

  for (const { id, path } of collectIds(doc)) {
    if (seen.has(id)) {
      ctx.addIssue({
        code: 'custom',
        path,
        message: `El id "${id}" está repetido en el documento.`,
      })
      continue
    }
    seen.add(id)
  }
}

export function checkDocumentInvariants(
  doc: UmlDocument,
  ctx: RefinementCtx,
  expectedSchemaVersion: number,
): void {
  if (doc.schemaVersion !== expectedSchemaVersion) {
    ctx.addIssue({
      code: 'custom',
      path: ['schemaVersion'],
      message: `Se esperaba schemaVersion ${expectedSchemaVersion} y llegó ${doc.schemaVersion}.`,
    })
  }

  const diagramIds = new Set(doc.diagrams.map((diagram) => diagram.id))

  checkNodes(doc, ctx, diagramIds)
  checkEdges(doc, ctx, diagramIds)
  checkContainment(doc, ctx)
  checkUniqueIds(doc, ctx)
}
