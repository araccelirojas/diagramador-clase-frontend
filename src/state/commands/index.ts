/**
 * Command registry (CLAUDE.md §6.2). Importing this module is what registers
 * every command by name, so `applyCommand({ type, payload })` can resolve a
 * command that arrived from the history stack or, in phase 4, from the wire.
 */

export * from '@/state/commands/defineCommand'
export * from '@/state/commands/document'
export * from '@/state/commands/edges'
export * from '@/state/commands/members'
export * from '@/state/commands/nodes'
