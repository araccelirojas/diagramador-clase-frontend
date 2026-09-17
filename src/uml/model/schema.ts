import { z } from 'zod'

import type { Equal, Expect } from '@/lib/typeAssert'
import { checkDocumentInvariants } from '@/uml/model/invariants'
import type { UmlDocument, UmlEdge, UmlNode } from '@/uml/model/types'

/** Bump on every change to the document shape, together with its migration. */
export const SCHEMA_VERSION = 1

export const DOCUMENT_KIND = 'uml-class-model'

const idSchema = z.string().min(1)
const isoDateSchema = z.string().min(1)

export const visibilitySchema = z.enum(['+', '-', '#', '~'])
export const parameterDirectionSchema = z.enum(['in', 'out', 'inout', 'return'])
export const nameDirectionSchema = z.enum(['none', 'sourceToTarget', 'targetToSource'])
export const edgeRoutingSchema = z.enum(['straight', 'orthogonal', 'bezier'])

export const parameterSchema = z.object({
  id: idSchema,
  name: z.string(),
  type: z.string().nullable(),
  direction: parameterDirectionSchema,
  defaultValue: z.string().nullable(),
})

export const propertySchema = z.object({
  kind: z.literal('property'),
  id: idSchema,
  name: z.string(),
  type: z.string().nullable(),
  visibility: visibilitySchema,
  multiplicity: z.string().nullable(),
  defaultValue: z.string().nullable(),
  isStatic: z.boolean(),
  isDerived: z.boolean(),
  isReadOnly: z.boolean(),
  isOrdered: z.boolean(),
  isUnique: z.boolean(),
})

export const operationSchema = z.object({
  kind: z.literal('operation'),
  id: idSchema,
  name: z.string(),
  visibility: visibilitySchema,
  parameters: z.array(parameterSchema),
  returnType: z.string().nullable(),
  isStatic: z.boolean(),
  isAbstract: z.boolean(),
  isQuery: z.boolean(),
})

export const literalSchema = z.object({
  kind: z.literal('literal'),
  id: idSchema,
  name: z.string(),
})

export const memberSchema = z.discriminatedUnion('kind', [
  propertySchema,
  operationSchema,
  literalSchema,
])

export const positionSchema = z.object({ x: z.number(), y: z.number() })

export const sizeSchema = z.object({
  width: z.number(),
  height: z.number().nullable(),
})

export const nodeStyleSchema = z.object({
  fill: z.string().optional(),
  stroke: z.string().optional(),
})

export const nodeSchema = z.object({
  id: idSchema,
  diagramId: idSchema,
  kind: z.string().min(1),
  name: z.string(),
  keywords: z.array(z.string()),
  isAbstract: z.boolean(),
  visibility: visibilitySchema,
  position: positionSchema,
  size: sizeSchema,
  z: z.number(),
  style: nodeStyleSchema.optional(),
  parentId: idSchema.nullable(),
  compartments: z.record(z.string(), z.array(memberSchema)),
})

export const associationEndSchema = z.object({
  role: z.string().nullable(),
  multiplicity: z.string().nullable(),
  visibility: visibilitySchema.nullable(),
  navigable: z.boolean().nullable(),
  isOrdered: z.boolean(),
  isUnique: z.boolean(),
})

export const edgeSchema = z.object({
  id: idSchema,
  diagramId: idSchema,
  kind: z.string().min(1),
  source: idSchema,
  target: idSchema,
  name: z.string().nullable(),
  nameDirection: nameDirectionSchema,
  ends: z.object({
    source: associationEndSchema,
    target: associationEndSchema,
  }),
  waypoints: z.array(positionSchema),
  routing: edgeRoutingSchema,
})

export const viewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive(),
})

export const diagramSchema = z.object({
  id: idSchema,
  name: z.string(),
  viewport: viewportSchema,
})

export const documentMetaSchema = z.object({
  name: z.string(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
})

const documentShapeSchema = z.object({
  schemaVersion: z.number().int(),
  kind: z.literal(DOCUMENT_KIND),
  meta: documentMetaSchema,
  diagrams: z.array(diagramSchema).min(1),
  nodes: z.record(z.string(), nodeSchema),
  edges: z.record(z.string(), edgeSchema),
})

/**
 * The invariants of CLAUDE.md §5.4 live in invariants.ts; a document that
 * breaks any of them is corrupt, not merely incomplete, so it is rejected
 * instead of opened.
 */
export const umlDocumentSchema = documentShapeSchema.superRefine((doc, ctx) => {
  checkDocumentInvariants(doc, ctx, SCHEMA_VERSION)
})

/** Keeps schema.ts and types.ts from drifting: these fail to compile if they do. */
export type _DocumentSchemaMatchesType = Expect<
  Equal<z.infer<typeof umlDocumentSchema>, UmlDocument>
>
export type _NodeSchemaMatchesType = Expect<Equal<z.infer<typeof nodeSchema>, UmlNode>>
export type _EdgeSchemaMatchesType = Expect<Equal<z.infer<typeof edgeSchema>, UmlEdge>>
