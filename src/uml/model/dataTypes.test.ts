import { describe, expect, it } from 'vitest'

import {
  BUILT_IN_TYPES,
  COMMON_DATA_TYPES,
  isBuiltInType,
  modelTypeNames,
  UML_PRIMITIVE_TYPES,
} from '@/uml/model/dataTypes'

describe('the built-in type catalogue', () => {
  it('has the five UML 2.5 primitive types', () => {
    expect(UML_PRIMITIVE_TYPES).toEqual([
      'Boolean',
      'Integer',
      'Real',
      'String',
      'UnlimitedNatural',
    ])
  })

  it('has no duplicates', () => {
    expect(new Set(BUILT_IN_TYPES).size).toBe(BUILT_IN_TYPES.length)
  })

  it('keeps the UML primitive and the platform type apart', () => {
    // `Integer` is the UML primitive, `int` the platform type: Enterprise
    // Architect lists both and collapsing them would lose that distinction.
    expect(isBuiltInType('Integer')).toBe(true)
    expect(isBuiltInType('int')).toBe(true)
    expect(COMMON_DATA_TYPES).toContain('int')
    expect(UML_PRIMITIVE_TYPES).not.toContain('int')
  })

  it('is case sensitive, like the types themselves', () => {
    expect(isBuiltInType('string')).toBe(false)
    expect(isBuiltInType('String')).toBe(true)
  })
})

describe('types taken from the model', () => {
  const nodes = (...names: string[]): Record<string, { name: string }> =>
    Object.fromEntries(names.map((name, index) => [`n_${index}`, { name }]))

  it('offers the classifiers in the document', () => {
    expect(modelTypeNames(nodes('Curso', 'Estudiante'))).toEqual(['Curso', 'Estudiante'])
  })

  it('sorts them the way a Spanish speaker reads a list', () => {
    expect(modelTypeNames(nodes('Zapato', 'Ánfora', 'arbol'))).toEqual([
      'Ánfora',
      'arbol',
      'Zapato',
    ])
  })

  it('drops a name that is already a built-in, so the list has no twins', () => {
    expect(modelTypeNames(nodes('String', 'Curso'))).toEqual(['Curso'])
  })

  it('ignores blank names from a box nobody has named yet', () => {
    expect(modelTypeNames(nodes('', '   ', 'Curso'))).toEqual(['Curso'])
  })

  it('lists a repeated name once', () => {
    expect(modelTypeNames(nodes('Curso', 'Curso'))).toEqual(['Curso'])
  })
})
