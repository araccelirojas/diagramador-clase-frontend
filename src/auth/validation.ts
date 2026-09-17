/**
 * Client-side mirror of `diagramador-backend/src/utils/validators.js`.
 *
 * The backend still validates everything — this only saves a round trip and
 * points at the offending field. If a rule changes there, it changes here too;
 * they are two copies of one decision on purpose, not a single shared source,
 * because the two repos ship separately.
 */

const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const PASSWORD_MIN_LENGTH = 8

export function validateNombre(valor: string): string | null {
  return valor.trim() === '' ? 'Escribe tu nombre.' : null
}

export function validateCorreo(valor: string): string | null {
  const correo = valor.trim()
  if (correo === '') return 'Escribe tu correo.'
  if (!CORREO_RE.test(correo)) return 'El correo no tiene un formato válido.'
  return null
}

export function validatePassword(valor: string): string | null {
  if (valor === '') return 'Escribe tu contraseña.'
  if (valor.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`
  }
  return null
}

/** The backend lowercases the address before looking it up; so do we. */
export function normalizeCorreo(valor: string): string {
  return valor.trim().toLowerCase()
}
