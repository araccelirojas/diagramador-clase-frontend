import type { UmlDocument } from '@/uml/model/types'

/**
 * Commands: the most important rule of the project (CLAUDE.md §6.2).
 *
 * Every mutation of the document goes through one. A command is a pure
 * function over the immer draft, with a name and a JSON-serializable payload.
 * That single constraint is what buys undo/redo once, collaboration in phase 4
 * (broadcasting `{ type, payload }` IS the sync mechanism) and pure-function
 * tests today.
 *
 * A payload may not contain functions, Date, Map, DOM nodes or React Flow
 * objects. If you need one of those, you are modelling the command wrong.
 */

/** What a command does to the document, in place, over an immer draft. */
export type CommandApply<TPayload> = (draft: UmlDocument, payload: TPayload) => void

/** The serializable value that travels: through history, and later the socket. */
export type Command<TPayload = unknown> = {
  type: string
  payload: TPayload
}

/** Calling a creator produces a Command; it never touches the store itself. */
export type CommandCreator<TPayload> = ((payload: TPayload) => Command<TPayload>) & {
  type: string
  apply: CommandApply<TPayload>
}

const registry = new Map<string, CommandApply<never>>()

export function defineCommand<TPayload>(
  type: string,
  apply: CommandApply<TPayload>,
): CommandCreator<TPayload> {
  if (registry.has(type)) {
    throw new Error(`Ya existe un comando registrado con el nombre "${type}".`)
  }
  registry.set(type, apply as CommandApply<never>)

  const creator = (payload: TPayload): Command<TPayload> => ({ type, payload })
  creator.type = type
  creator.apply = apply

  return creator
}

/** Looks up the handler by name: the entry point for undo replay and phase 4. */
export function getCommandApply(type: string): CommandApply<never> | undefined {
  return registry.get(type)
}

/** Applies a command to a draft. Throws on an unknown name rather than no-op. */
export function applyCommand(draft: UmlDocument, command: Command): void {
  const apply = registry.get(command.type)

  if (!apply) {
    throw new Error(`Comando desconocido: "${command.type}".`)
  }

  apply(draft, command.payload as never)
}
