import { produce } from 'immer'

import {
  applyBatch,
  applyCommand,
  entitiesToRestore,
  restoreEntities,
  type Command,
} from '@/state/commands'
import { useDiagramStore } from '@/state/useDiagramStore'
import type { UmlDocument } from '@/uml/model/types'
import { ejecutarHerramienta, sobreDestino } from '@/voz/herramientas'

/**
 * A change to the diagram proposed by the chat AI (CU-04).
 *
 * The server asks the model, and the model answers with operations: the same
 * tools the voice agent uses, by name, with their arguments. The server cannot
 * run them — the UML model lives here — so it hands them to ONE client in the
 * room (the person who asked, when possible), which runs them here:
 *
 *   1. Over a working copy of the document, collecting the commands they
 *      dispatch instead of letting each one reach the store.
 *   2. All of those as a single `applyBatch`: one change for the room, one
 *      message on the socket, and kept or thrown away as a whole.
 *   3. Out of the before/after difference, the command that undoes it. The
 *      server keeps it and, if the room votes the change down, sends it to
 *      everyone — so discarding still works after this client has left.
 */

export type ProposedOperation = { nombre: string; argumentos: unknown }

export type OperationResult = { nombre: string; ok: boolean; texto: string }

/** What goes back to the server as the ack of `ia-propuesta`. */
export type ProposalAck =
  | {
      ok: true
      resultados: OperationResult[]
      /** False when nothing changed (every operation failed): there is nothing to vote on. */
      aplicado: boolean
      nodos: string[]
      aristas: string[]
      reversion: Command | null
    }
  | { ok: false; message: string }

/**
 * What the chat AI may do. Reading is not here because it already has the
 * diagram in its context, and `deshacer` is not here because it would undo
 * whatever this client did last — possibly someone's own edit.
 */
export const PROPOSAL_TOOLS: ReadonlySet<string> = new Set([
  'crear_clase',
  'renombrar_clase',
  'eliminar_clase',
  'mover_clase',
  'agregar_atributo',
  'modificar_atributo',
  'quitar_atributo',
  'agregar_operacion',
  'quitar_operacion',
  'crear_relacion',
  'modificar_relacion',
  'eliminar_relacion',
  'ordenar_diagrama',
  'cambiar_trazado',
  'enderezar_relacion',
])

/**
 * The voice agent must ask before deleting and call again with
 * `confirmado: true`. Here the vote of the room IS that confirmation, and
 * nothing is final until it happens.
 */
const CONFIRMED_BY_VOTE: ReadonlySet<string> = new Set(['eliminar_clase', 'eliminar_relacion'])

/** A proposal larger than this is not a change, it is a different diagram. */
export const MAX_OPERATIONS = 40

/**
 * Runs the operations over `base` without touching the store. Pure apart from
 * the canvas flash the tools trigger, which is harmless.
 */
export function runProposal(
  base: UmlDocument,
  operations: ProposedOperation[],
): { results: OperationResult[]; commands: Command[]; after: UmlDocument } {
  let working = base
  const commands: Command[] = []

  const results = sobreDestino(
    {
      doc: () => working,
      despachar: (command) => {
        working = produce(working, (draft) => applyCommand(draft, command))
        commands.push(command)
      },
    },
    () =>
      operations.map(({ nombre, argumentos }): OperationResult => {
        if (!PROPOSAL_TOOLS.has(nombre)) {
          return { nombre, ok: false, texto: `La IA del chat no puede usar "${nombre}".` }
        }

        const args =
          CONFIRMED_BY_VOTE.has(nombre) && typeof argumentos === 'object' && argumentos !== null
            ? { ...argumentos, confirmado: true }
            : argumentos

        const result = ejecutarHerramienta(nombre, args)
        return result.ok
          ? { nombre, ok: true, texto: result.mensaje }
          : { nombre, ok: false, texto: result.error }
      }),
  )

  return { results, commands, after: working }
}

function readOperations(payload: unknown): ProposedOperation[] | null {
  if (typeof payload !== 'object' || payload === null) return null
  const { operaciones } = payload as { operaciones?: unknown }
  if (!Array.isArray(operaciones) || operaciones.length > MAX_OPERATIONS) return null

  const operations: ProposedOperation[] = []
  for (const item of operaciones) {
    if (typeof item !== 'object' || item === null) return null
    const { nombre, argumentos } = item as { nombre?: unknown; argumentos?: unknown }
    if (typeof nombre !== 'string') return null
    operations.push({ nombre, argumentos: argumentos ?? {} })
  }
  return operations
}

/**
 * Runs a proposal that arrived from the server on the live document, and
 * dispatches it so the room gets it. Never throws: the server is waiting for
 * this answer, and a silence would leave the AI hanging until its timeout.
 */
export function applyProposal(payload: unknown): ProposalAck {
  const operations = readOperations(payload)
  if (!operations) return { ok: false, message: 'La propuesta de la IA no tiene un formato válido.' }

  try {
    const before = useDiagramStore.getState().doc
    const { results, commands, after } = runProposal(before, operations)

    if (commands.length === 0 || after === before) {
      return { ok: true, resultados: results, aplicado: false, nodos: [], aristas: [], reversion: null }
    }

    // Outside the history: the vote decides whether this stays, not Ctrl+Z.
    useDiagramStore.getState().dispatch(applyBatch({ commands }), { history: false })

    const applied = useDiagramStore.getState().doc
    const restore = entitiesToRestore(before, applied)

    return {
      ok: true,
      resultados: results,
      aplicado: true,
      // What is on the canvas now because of the AI: what the room marks as provisional.
      nodos: Object.keys(restore.nodes).filter((id) => applied.nodes[id] !== undefined),
      aristas: Object.keys(restore.edges).filter((id) => applied.edges[id] !== undefined),
      reversion: restoreEntities(restore),
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'No se pudo aplicar la propuesta de la IA.',
    }
  }
}
