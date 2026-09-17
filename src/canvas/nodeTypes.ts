import type { NodeTypes } from '@xyflow/react'

import { ClassifierNode } from '@/canvas/nodes/ClassifierNode'
import { CLASSIFIER_LIST } from '@/uml/registry'

/**
 * kind -> component, derived from the registry (CLAUDE.md §4). A spec only
 * needs its own component when it is not a box of compartments, and then it
 * says so through `render`.
 *
 * Built once at module load: React Flow re-mounts every node if this object
 * changes identity between renders.
 */
export const nodeTypes: NodeTypes = Object.fromEntries(
  CLASSIFIER_LIST.map((spec) => [spec.kind, spec.render ?? ClassifierNode]),
) as NodeTypes
