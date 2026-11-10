/**
 * "Jarvis": el nombre con el que se le habla a la IA dentro de la llamada de voz.
 *
 * Cada navegador transcribe solo lo que dice su persona, y al servidor manda únicamente lo
 * que empieza por "Jarvis". La conversación entre ustedes no sale de acá.
 *
 * Es la misma regla que `src/llamada/jarvis.js` del backend: las dos tienen que reconocer
 * lo mismo.
 */

/**
 * Cómo suele escribir "Jarvis" un transcriptor que espera español. Además de esta lista
 * vale cualquier palabra a un cambio de "jarvis" ("jarvys", "jarvic").
 */
const VARIANTES = new Set([
  'jarvis', 'jarbis', 'jarviz', 'jarvi', 'jarbi', 'yarvis', 'yarbis', 'yarviz', 'yarvi',
  'harvis', 'harbis', 'llarvis', 'llarbis', 'charvis', 'jervis', 'yervis', 'garvis', 'shervis',
])

/** Palabras que pueden ir antes del nombre: "oye Jarvis", "ok, Jarvis". */
const MAX_PALABRAS_ANTES = 2

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function distancia(a: string, b: string): number {
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j)

  for (let i = 1; i <= a.length; i += 1) {
    const actual = [i]
    for (let j = 1; j <= b.length; j += 1) {
      actual[j] = Math.min(
        (previa[j] ?? 0) + 1,
        (actual[j - 1] ?? 0) + 1,
        (previa[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previa = actual
  }

  return previa[b.length] ?? 0
}

function esJarvis(palabra: string): boolean {
  const limpia = normalizar(palabra)
  if (VARIANTES.has(limpia)) return true
  return limpia.length >= 5 && limpia.length <= 7 && distancia(limpia, 'jarvis') <= 1
}

/**
 * @returns `resto`: lo que viene después del nombre ('' si solo dijo "Jarvis"); null si
 *   no le hablaba a Jarvis.
 */
export function detectarJarvis(texto: string): { resto: string } | null {
  const palabras = [...texto.matchAll(/[\p{L}\p{N}]+/gu)]
  const limite = Math.min(palabras.length, MAX_PALABRAS_ANTES + 1)

  for (let i = 0; i < limite; i += 1) {
    const palabra = palabras[i]
    if (palabra === undefined || !esJarvis(palabra[0])) continue

    const resto = texto
      .slice((palabra.index ?? 0) + palabra[0].length)
      // La coma o el punto después del nombre sobran; el "¿" de la pregunta no.
      .replace(/^[\s,.;:!?…-]+/u, '')
      .trim()
    return { resto }
  }

  return null
}
