import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

import { useAuthStore } from '@/auth/useAuthStore'
import { deserializeValue } from '@/io/deserialize'
import { serialize } from '@/io/serialize'
import { applyRemote, onStoreChange, useDiagramStore, type StoreChange } from '@/state/useDiagramStore'
import type { UmlDocument } from '@/uml/model/types'

/**
 * Real-time collaboration: one room per project.
 *
 * What travels is the COMMAND, not the diagram. That is the whole payoff of
 * CLAUDE.md §6.2 — every mutation already goes through a command with a
 * JSON-serializable payload, so broadcasting `{ type, payload }` IS the sync
 * mechanism. Moving a box costs a few dozen bytes.
 *
 * Undo, redo and import are the exception: they replace the document wholesale
 * instead of applying a command, so there is nothing small to send and the
 * whole thing goes.
 *
 * Saving is NOT here. The room's server owns a single timer (one per room, not
 * one per person) and asks whoever it designated for a snapshot when it fires.
 */

/** The socket server lives on the API host, without the /api prefix. */
const SOCKET_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(
  /\/api\/?$/,
  '',
)

export type CollaborationState = {
  status: 'off' | 'connecting' | 'connected' | 'error'
  /** How many people are in the room, this client included. */
  members: number
  /** When the ROOM last saved. Not this client's doing. */
  savedAt: number | null
  error: string | null
}

const OFF: CollaborationState = { status: 'off', members: 0, savedAt: null, error: null }

const CONNECTING: CollaborationState = { ...OFF, status: 'connecting' }

type CambioPayload = {
  kind: 'command' | 'document'
  command?: { type: string; payload: unknown }
  doc?: unknown
  de?: string
}

export function useCollaboration(idProyecto: string, enabled: boolean): CollaborationState {
  const token = useAuthStore((state) => state.token)
  // Starts as "connecting" rather than being set so inside the effect: the
  // value is known before the first render, and setting state synchronously in
  // an effect only buys an extra render.
  const [state, setState] = useState<CollaborationState>(CONNECTING)

  const socketRef = useRef<Socket | null>(null)
  /**
   * The document reference we last handed over as a snapshot. When the room
   * reports a save we only clear `isDirty` if the store still holds exactly
   * that — anything else and we would be marking somebody's newer edit as
   * saved, which is the one mistake here that loses work.
   */
  const snapshotRef = useRef<UmlDocument | null>(null)

  /** Nothing from the wire is trusted: it is validated like an imported file. */
  const applyDocument = useCallback((raw: unknown): boolean => {
    const result = deserializeValue(raw)

    if (!result.ok) {
      useDiagramStore.getState().setNotice(`Llegó un diagrama que no se pudo leer: ${result.error}`)
      return false
    }

    applyRemote(() => useDiagramStore.getState().replaceDocument(result.doc))
    return true
  }, [])

  useEffect(() => {
    if (!enabled || token === null || idProyecto === '') return

    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit(
        'unirse',
        { idProyecto },
        (respuesta: { ok: boolean; message?: string; contenido?: unknown; miembros?: number }) => {
          if (!respuesta.ok) {
            setState({ ...OFF, status: 'error', error: respuesta.message ?? 'No se pudo entrar.' })
            return
          }

          // Someone was already in: their screen, not the database, is the
          // truth — it may hold edits that have not been saved yet.
          if (respuesta.contenido !== null && respuesta.contenido !== undefined) {
            applyDocument(respuesta.contenido)
          }

          setState({
            status: 'connected',
            members: respuesta.miembros ?? 1,
            savedAt: null,
            error: null,
          })
        },
      )
    })

    socket.on('connect_error', (error: Error) => {
      setState({ ...OFF, status: 'error', error: error.message })
    })

    socket.on('cambio', (payload: CambioPayload) => {
      if (payload.kind === 'document') {
        applyDocument(payload.doc)
        return
      }

      if (!payload.command) return

      try {
        applyRemote(() => {
          // Not in the history: Ctrl+Z must undo MY last change, never someone
          // else's. (§6.4 — a shared history is Yjs's job, not ours.)
          useDiagramStore.getState().dispatch(payload.command as never, { history: false })
        })
      } catch {
        useDiagramStore
          .getState()
          .setNotice('Llegó un cambio que este editor no entiende. Recargá la página.')
      }
    })

    socket.on('entro', () => setState((current) => ({ ...current, members: current.members + 1 })))
    socket.on('salio', () =>
      setState((current) => ({ ...current, members: Math.max(1, current.members - 1) })),
    )

    // The room's timer fired and this client is the one it asks.
    socket.on('pedir-snapshot', () => {
      const doc = useDiagramStore.getState().doc
      snapshotRef.current = doc
      socket.emit('snapshot', { contenido: serialize(doc) })
    })

    socket.on('guardado', ({ at }: { at: number }) => {
      setState((current) => ({ ...current, savedAt: at, error: null }))

      // immer hands out a new reference on every change, so this is exactly
      // "nothing was edited between handing over the snapshot and the save".
      if (useDiagramStore.getState().doc === snapshotRef.current) {
        useDiagramStore.getState().markSaved()
      }
    })

    socket.on('error-guardado', ({ message }: { message: string }) => {
      setState((current) => ({ ...current, error: message }))
    })

    // Local changes go out. `onStoreChange` never fires for what we applied
    // through `applyRemote`, which is what stops the echo between clients.
    const unsubscribe = onStoreChange((change: StoreChange) => {
      if (!socket.connected) return

      socket.emit(
        'cambio',
        change.kind === 'command'
          ? { kind: 'command', command: change.command }
          : { kind: 'document', doc: serialize(change.doc) },
      )
    })

    return () => {
      unsubscribe()
      socket.close()
      socketRef.current = null
      snapshotRef.current = null
      // Leaving one project for another must not show the previous room's
      // members while the new one is still connecting.
      setState(CONNECTING)
    }
  }, [enabled, idProyecto, token, applyDocument])

  // Derived, not stored: with the hook disabled there is no room at all, and
  // holding a stale "connected" for a frame would let the autosave believe a
  // room owns the save clock when none does.
  return enabled && token !== null ? state : OFF
}
