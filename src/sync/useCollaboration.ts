import { useCallback, useEffect, useState } from 'react'
import { io } from 'socket.io-client'

import { useAuthStore } from '@/auth/useAuthStore'
import type { Vote } from '@/ia/useVoteStore'
import { deserializeValue } from '@/io/deserialize'
import { serialize } from '@/io/serialize'
import { applyRemote, onStoreChange, useDiagramStore, type StoreChange } from '@/state/useDiagramStore'
import type { IncomingEphemeral, Participant } from '@/sync/presence'
import { listenRoomChannels, roomClosed, roomDropped, roomJoined } from '@/sync/roomChannels'
import { usePresenceStore } from '@/sync/usePresenceStore'
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
 * Presence (who is here, their cursor, selection and status) rides a separate
 * `efimero` channel into `usePresenceStore`, never into the document.
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
  /**
   * `reconnecting`: we were in the room and the connection dropped. socket.io
   * retries on its own; the editor keeps working and what is edited meanwhile
   * is queued and sent once the room is back.
   */
  status: 'off' | 'connecting' | 'connected' | 'reconnecting' | 'error'
  /** When the ROOM last saved. Not this client's doing. */
  savedAt: number | null
  error: string | null
}

const OFF: CollaborationState = { status: 'off', savedAt: null, error: null }

const CONNECTING: CollaborationState = { ...OFF, status: 'connecting' }

type CambioPayload = {
  kind: 'command' | 'document'
  command?: { type: string; payload: unknown }
  doc?: unknown
  de?: string
}

type UnirseRespuesta = {
  ok: boolean
  message?: string
  contenido?: unknown
  participantes?: Participant[]
  /** CU-04: the vote in progress, if the room is voting on an AI change. */
  votacion?: Vote | null
  /**
   * CU-04: an AI change the room voted down while nobody was in it, so the
   * command that undoes it never reached anyone. It is ours to apply.
   */
  reversion?: { type: string; payload: unknown } | null
}

type SalioPayload = { idSocket: string; motivo?: 'salida' | 'desconexion' }

/** Past this many offline commands, the queue collapses into one document. */
const MAX_QUEUED_COMMANDS = 300

export function useCollaboration(idProyecto: string, enabled: boolean): CollaborationState {
  const token = useAuthStore((state) => state.token)
  // Starts as "connecting" rather than being set so inside the effect: the
  // value is known before the first render, and setting state synchronously in
  // an effect only buys an extra render.
  const [state, setState] = useState<CollaborationState>(CONNECTING)

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
    const presence = usePresenceStore.getState()

    /**
     * The document reference we last handed over as a snapshot. When the room
     * reports a save we only clear `isDirty` if the store still holds exactly
     * that — anything else and we would be marking somebody's newer edit as
     * saved, which is the one mistake here that loses work.
     *
     * A closure variable, not a ref: it belongs to THIS socket and dies with it.
     */
    let snapshot: UmlDocument | null = null

    /** We have been in the room at least once: a drop now means "reconnecting". */
    let hasJoined = false

    /**
     * What was edited while the connection was down. Commands are replayed on
     * top of whatever the room holds when we are back; a wholesale change
     * (undo, import) cannot be merged, so it marks the local document as the
     * one to keep.
     */
    let queuedCommands: StoreChange[] = []
    let queuedDocument = false

    const emitChange = (change: StoreChange): void => {
      socket.emit(
        'cambio',
        change.kind === 'command'
          ? { kind: 'command', command: change.command }
          : { kind: 'document', doc: serialize(change.doc) },
      )
    }

    const sendDocument = (): void => {
      emitChange({ kind: 'document', doc: useDiagramStore.getState().doc })
    }

    /** Tells a room we just (re)entered what we have selected and what we are doing. */
    const announce = (): void => {
      const { selection } = useDiagramStore.getState()
      socket.emit('efimero', { tipo: 'seleccion', nodos: selection.nodes, aristas: selection.edges })
      socket.emit('efimero', { tipo: 'estado', estado: usePresenceStore.getState().selfStatus })
    }

    /** After a reconnection: put back what was done offline. */
    const flushQueue = (roomContent: unknown): void => {
      const commands = queuedCommands
      const wholesale = queuedDocument
      queuedCommands = []
      queuedDocument = false

      const othersHaveContent = roomContent !== null && roomContent !== undefined

      // Alone in the room, or an offline change that cannot be merged: this
      // screen is the truth and the room gets it whole.
      if (!othersHaveContent || wholesale) {
        if (wholesale && othersHaveContent) {
          useDiagramStore
            .getState()
            .setNotice('Volviste a conectarte. Tus cambios sin conexión reemplazaron los de la sala.')
        }
        if (commands.length > 0 || wholesale) sendDocument()
        return
      }

      // Others were editing too: take their document, then replay ours on top,
      // the same as if our commands had arrived a little late.
      if (!applyDocument(roomContent)) return

      let failed = 0
      for (const change of commands) {
        if (change.kind !== 'command') continue
        try {
          // Not applyRemote: this one has to go out to the room.
          useDiagramStore.getState().dispatch(change.command, { history: false })
        } catch {
          failed += 1
        }
      }

      if (failed > 0) {
        useDiagramStore
          .getState()
          .setNotice(`Volviste a conectarte. ${failed} cambio(s) hechos sin conexión ya no se pudieron aplicar.`)
      }
    }

    socket.on('connect', () => {
      socket.emit('unirse', { idProyecto }, (respuesta: UnirseRespuesta) => {
        if (!respuesta.ok) {
          setState({ ...OFF, status: 'error', error: respuesta.message ?? 'No se pudo entrar.' })
          return
        }

        const rejoining = hasJoined
        hasJoined = true

        usePresenceStore.getState().joined(socket.id ?? '', respuesta.participantes ?? [])

        roomJoined(socket, respuesta.votacion ?? null, rejoining)
        usePresenceStore.getState().setSender((message) => {
          if (!socket.connected) return
          // Only the cursor may be dropped under load: the next one replaces
          // it. A lost status or selection would stay wrong until it changes.
          if (message.tipo === 'cursor') socket.volatile.emit('efimero', message)
          else socket.emit('efimero', message)
        })

        if (rejoining) {
          flushQueue(respuesta.contenido)
        } else if (respuesta.contenido !== null && respuesta.contenido !== undefined) {
          // Someone was already in: their screen, not the database, is the
          // truth — it may hold edits that have not been saved yet.
          applyDocument(respuesta.contenido)
        }

        if (respuesta.reversion) {
          try {
            // Dispatched as our own change, not applyRemote: the room's copy (and the
            // save) has to get it too.
            useDiagramStore.getState().dispatch(respuesta.reversion as never, { history: false })
          } catch {
            useDiagramStore
              .getState()
              .setNotice('No se pudieron deshacer unos cambios de la IA que la sala había descartado.')
          }
        }

        announce()
        setState({ status: 'connected', savedAt: null, error: null })
      })
    })

    socket.on('disconnect', (reason) => {
      usePresenceStore.getState().setSender(null)
      roomDropped()
      // Our own `socket.close()` in the cleanup: not a drop, nothing to show.
      if (reason === 'io client disconnect') return

      setState((current) => ({ ...current, status: hasJoined ? 'reconnecting' : 'connecting' }))
    })

    socket.on('connect_error', (error: Error) => {
      // While reconnecting, every failed retry lands here; that is still
      // "reconnecting", not a dead end. An auth failure is different: socket.io
      // will not retry it, so it is reported as the error it is.
      if (hasJoined && socket.active) {
        setState((current) => ({ ...current, status: 'reconnecting' }))
        return
      }
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

    socket.on('entro', (participant: Participant) => usePresenceStore.getState().entered(participant))

    socket.on('salio', ({ idSocket, motivo }: SalioPayload) =>
      usePresenceStore.getState().left(idSocket, motivo === 'desconexion'),
    )

    socket.on('efimero', (message: IncomingEphemeral) => usePresenceStore.getState().received(message))

    // Chat, AI proposals and votes (CU-02 to CU-04).
    listenRoomChannels(socket)

    // The room's timer fired and this client is the one it asks.
    socket.on('pedir-snapshot', () => {
      const doc = useDiagramStore.getState().doc
      snapshot = doc
      socket.emit('snapshot', { contenido: serialize(doc) })
    })

    socket.on('guardado', ({ at }: { at: number }) => {
      setState((current) => ({ ...current, savedAt: at, error: null }))

      // immer hands out a new reference on every change, so this is exactly
      // "nothing was edited between handing over the snapshot and the save".
      if (useDiagramStore.getState().doc === snapshot) {
        useDiagramStore.getState().markSaved()
      }
    })

    socket.on('error-guardado', ({ message }: { message: string }) => {
      setState((current) => ({ ...current, error: message }))
    })

    // Local changes go out. `onStoreChange` never fires for what we applied
    // through `applyRemote`, which is what stops the echo between clients.
    const unsubscribe = onStoreChange((change: StoreChange) => {
      if (socket.connected) {
        emitChange(change)
        return
      }

      // Never been in the room: there is nothing to catch up with, the local
      // autosave owns this document.
      if (!hasJoined) return

      if (change.kind === 'document' || queuedCommands.length >= MAX_QUEUED_COMMANDS) {
        queuedDocument = true
        queuedCommands = []
      } else if (!queuedDocument) {
        queuedCommands.push(change)
      }
    })

    return () => {
      unsubscribe()
      socket.close()
      presence.reset()
      roomClosed()
      // Leaving one project for another must not show the previous room's
      // status while the new one is still connecting.
      setState(CONNECTING)
    }
  }, [enabled, idProyecto, token, applyDocument])

  // Derived, not stored: with the hook disabled there is no room at all, and
  // holding a stale "connected" for a frame would let the autosave believe a
  // room owns the save clock when none does.
  return enabled && token !== null ? state : OFF
}
