/**
 * Qué acaba de tocar el agente, para que se vea en el lienzo.
 *
 * Es estado efímero puro: no entra en el documento ni se guarda ni viaja por el socket
 * (CLAUDE.md §10.2). Vive aquí, en un módulo, con el mismo patrón de suscripción que usa
 * `onStoreChange`, para no meter en el store algo que no debe persistir jamás.
 */

const resaltados = new Set<string>()
const oyentes = new Set<() => void>()

/** Cuánto dura el destello. Lo justo para ver qué cambió sin que moleste. */
const DURACION_MS = 2000

const avisar = (): void => {
  for (const oyente of oyentes) oyente()
}

export function resaltar(...ids: string[]): void {
  for (const id of ids) {
    resaltados.add(id)

    setTimeout(() => {
      resaltados.delete(id)
      avisar()
    }, DURACION_MS)
  }

  avisar()
}

export const estaResaltado = (id: string): boolean => resaltados.has(id)

export function onResaltado(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}
