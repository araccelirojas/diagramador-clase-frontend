import { describe, expect, it } from 'vitest'

import { createLiteral, createOperation, createParameter, createProperty } from '@/uml/model/factories'
import {
  formatKeywords,
  formatMember,
  formatOperation,
  formatParameter,
  formatProperty,
} from '@/uml/model/format'

describe('formatProperty', () => {
  it('formats a plain attribute', () => {
    expect(formatProperty(createProperty({ name: 'nombre', type: 'String', visibility: '-' }))).toBe(
      '- nombre : String',
    )
  })

  it('formats the full UML notation', () => {
    const property = createProperty({
      name: 'notas',
      type: 'Nota',
      visibility: '+',
      multiplicity: '0..*',
      defaultValue: '[]',
      isDerived: true,
      isReadOnly: true,
      isOrdered: true,
      isUnique: false,
    })

    expect(formatProperty(property)).toBe('+ /notas : Nota [0..*] = [] {readOnly, ordered, nonunique}')
  })

  it('omits modifiers that match the UML defaults', () => {
    const property = createProperty({ name: 'edad', type: 'int', isUnique: true, isOrdered: false })

    expect(formatProperty(property)).toBe('- edad : int')
  })

  it('omits the type when there is none', () => {
    expect(formatProperty(createProperty({ name: 'x', type: null }))).toBe('- x')
  })
})

describe('formatParameter', () => {
  it('leaves the "in" direction implicit', () => {
    expect(formatParameter(createParameter({ name: 'curso', type: 'Curso' }))).toBe('curso : Curso')
  })

  it('shows any other direction', () => {
    expect(
      formatParameter(createParameter({ name: 'resultado', type: 'int', direction: 'out' })),
    ).toBe('out resultado : int')
  })

  it('shows the default value', () => {
    expect(
      formatParameter(createParameter({ name: 'activo', type: 'boolean', defaultValue: 'true' })),
    ).toBe('activo : boolean = true')
  })
})

describe('formatOperation', () => {
  it('formats an operation with no parameters', () => {
    expect(formatOperation(createOperation({ name: 'guardar' }))).toBe('+ guardar()')
  })

  it('formats parameters, return type and {query}', () => {
    const operation = createOperation({
      name: 'buscar',
      visibility: '#',
      returnType: 'Estudiante',
      isQuery: true,
      parameters: [
        createParameter({ name: 'codigo', type: 'String' }),
        createParameter({ name: 'encontrado', type: 'boolean', direction: 'out' }),
      ],
    })

    expect(formatOperation(operation)).toBe(
      '# buscar(codigo : String, out encontrado : boolean) : Estudiante {query}',
    )
  })
})

describe('formatMember', () => {
  it('dispatches on the member kind', () => {
    expect(formatMember(createProperty({ name: 'a', type: 'int' }))).toBe('- a : int')
    expect(formatMember(createOperation({ name: 'b' }))).toBe('+ b()')
    expect(formatMember(createLiteral({ name: 'ACTIVO' }))).toBe('ACTIVO')
  })
})

describe('formatKeywords', () => {
  it('wraps the keywords in guillemets', () => {
    expect(formatKeywords(['interface'])).toBe('«interface»')
    expect(formatKeywords(['entity', 'root'])).toBe('«entity, root»')
  })

  it('returns null when there is nothing to show', () => {
    expect(formatKeywords([])).toBeNull()
    expect(formatKeywords(['  '])).toBeNull()
  })
})
