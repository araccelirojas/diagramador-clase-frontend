import type { EdgeTypes } from '@xyflow/react'

import { UmlEdge } from '@/canvas/edges/UmlEdge'
import { RELATION_LIST } from '@/uml/registry'

/**
 * kind -> component, derived from the registry. Every relation is the same
 * component: what changes between them is their spec, not their code.
 *
 * Built once at module load so React Flow does not re-mount every edge.
 */
export const edgeTypes: EdgeTypes = Object.fromEntries(
  RELATION_LIST.map((spec) => [spec.kind, UmlEdge]),
) as EdgeTypes
