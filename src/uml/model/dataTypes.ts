/**
 * The types offered when picking the type of an attribute, a parameter or a
 * return value.
 *
 * Two fixed groups plus one derived from the document, which is how Enterprise
 * Architect's type combo behaves: the built-in data types, and every classifier
 * already in the model.
 *
 * This is a CONVENIENCE, never a constraint. `type` stays a free string in the
 * model (§5.2): generics like `List<Curso>`, types from a language the editor
 * knows nothing about, and half-written names during modelling all have to keep
 * working. The picker offers, it does not police.
 */

/** UML 2.5 §21.3 — the PrimitiveTypes the standard itself defines. */
export const UML_PRIMITIVE_TYPES: readonly string[] = [
  'Boolean',
  'Integer',
  'Real',
  'String',
  'UnlimitedNatural',
]

/**
 * The data types Enterprise Architect offers out of the box for a model with no
 * implementation language set. Lower case on purpose: that is how EA lists
 * them, and it is what distinguishes the platform type `int` from a UML
 * `Integer`.
 */
export const COMMON_DATA_TYPES: readonly string[] = [
  'byte',
  'char',
  'date',
  'datetime',
  'decimal',
  'double',
  'float',
  'int',
  'long',
  'object',
  'short',
  'timestamp',
  'void',
]

/** Everything the editor knows without looking at the document. */
export const BUILT_IN_TYPES: readonly string[] = [...UML_PRIMITIVE_TYPES, ...COMMON_DATA_TYPES]

const BUILT_IN_SET = new Set<string>(BUILT_IN_TYPES)

export const isBuiltInType = (type: string): boolean => BUILT_IN_SET.has(type)

/**
 * Classifier names usable as a type, from the document itself.
 *
 * Deduplicated against the built-ins so a class the user named `String` does
 * not appear twice, and sorted the way a Spanish speaker reads a list.
 */
export function modelTypeNames(nodes: Record<string, { name: string }>): string[] {
  const names = new Set<string>()

  for (const node of Object.values(nodes)) {
    const name = node.name.trim()
    if (name !== '' && !BUILT_IN_SET.has(name)) names.add(name)
  }

  return [...names].sort((a, b) => a.localeCompare(b, 'es'))
}
