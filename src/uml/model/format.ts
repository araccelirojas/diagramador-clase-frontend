import type { Literal, Member, Operation, Parameter, Property } from '@/uml/model/types'

/**
 * UML 2.5 textual notation for members (CLAUDE.md §5).
 *
 * Two adornments are deliberately NOT encoded here because they are typography,
 * not text: `isStatic` renders underlined and an abstract operation renders in
 * italics. The node component applies those.
 *
 * Modifiers follow the UML convention of showing only what deviates from the
 * default (unique = true, ordered = false), so a plain attribute stays clean.
 */

const GUILLEMET_OPEN = '«'
const GUILLEMET_CLOSE = '»'

function joinModifiers(modifiers: string[]): string {
  return modifiers.length > 0 ? ` {${modifiers.join(', ')}}` : ''
}

export function formatProperty(property: Property): string {
  const modifiers: string[] = []
  if (property.isReadOnly) modifiers.push('readOnly')
  if (property.isOrdered) modifiers.push('ordered')
  if (!property.isUnique) modifiers.push('nonunique')

  const derived = property.isDerived ? '/' : ''
  const type = property.type ? ` : ${property.type}` : ''
  const multiplicity = property.multiplicity ? ` [${property.multiplicity}]` : ''
  const defaultValue = property.defaultValue ? ` = ${property.defaultValue}` : ''

  return `${property.visibility} ${derived}${property.name}${type}${multiplicity}${defaultValue}${joinModifiers(modifiers)}`
}

export function formatParameter(parameter: Parameter): string {
  // 'in' is the UML default and is left implicit.
  const direction = parameter.direction === 'in' ? '' : `${parameter.direction} `
  const type = parameter.type ? ` : ${parameter.type}` : ''
  const defaultValue = parameter.defaultValue ? ` = ${parameter.defaultValue}` : ''

  return `${direction}${parameter.name}${type}${defaultValue}`
}

export function formatOperation(operation: Operation): string {
  const parameters = operation.parameters.map(formatParameter).join(', ')
  const returnType = operation.returnType ? ` : ${operation.returnType}` : ''
  const modifiers = operation.isQuery ? ['query'] : []

  return `${operation.visibility} ${operation.name}(${parameters})${returnType}${joinModifiers(modifiers)}`
}

export function formatLiteral(literal: Literal): string {
  return literal.name
}

/** Exhaustive over Member: a new variant breaks the build here. */
export function formatMember(member: Member): string {
  switch (member.kind) {
    case 'property':
      return formatProperty(member)
    case 'operation':
      return formatOperation(member)
    case 'literal':
      return formatLiteral(member)
  }
}

/** ['entity'] renders as «entity»; empty keywords render as nothing. */
export function formatKeywords(keywords: readonly string[]): string | null {
  const present = keywords.filter((keyword) => keyword.trim() !== '')
  if (present.length === 0) return null

  return `${GUILLEMET_OPEN}${present.join(', ')}${GUILLEMET_CLOSE}`
}
