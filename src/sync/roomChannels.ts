import type { Socket } from 'socket.io-client'

import type { Mensaje, VersionResumen } from '@/api/types'
import { useAuthStore } from '@/auth/useAuthStore'
import { loadLatest, useChatStore, type OutgoingMessage, type SendResult } from '@/chat/useChatStore'
import { applyProposal, type ProposalAck } from '@/ia/proposal'
import { useVoteStore, type Vote } from '@/ia/useVoteStore'
import { loadVersions, useVersionStore } from '@/versions/useVersionStore'

/**
 * What the room says besides the document and presence: the chat (CU-02,
 * CU-03), the AI's proposed changes and the vote on them (CU-04), and new
 * versions in the history (CU-05).
 *
 * Kept apart from `useCollaboration`, which owns the connection and the
 * document; these only need a socket to talk through.
 */

/** A chat message or a vote without an ack after this long counts as not sent. */
const ACK_TIMEOUT_MS = 15_000

function ackOrFail<T extends { ok: boolean; message?: string }>(
  socket: Socket,
  event: string,
  payload: unknown,
  timeoutMessage: string,
): Promise<T> {
  return new Promise((resolve) => {
    if (!socket.connected) {
      resolve({ ok: false, message: 'Sin conexión con la sala.' } as T)
      return
    }
    socket.timeout(ACK_TIMEOUT_MS).emit(event, payload, (error: Error | null, ack: T) => {
      resolve(error ? ({ ok: false, message: timeoutMessage } as T) : ack)
    })
  })
}

/** Registers the listeners once per socket. */
export function listenRoomChannels(socket: Socket): void {
  socket.on('mensaje', (message: Mensaje) =>
    useChatStore.getState().received(message, useAuthStore.getState().usuario?.idUsuario ?? null),
  )
  socket.on('ia-escribiendo', ({ activo, respondeA }: { activo: boolean; respondeA: string }) =>
    useChatStore.getState().setAiTyping(respondeA, activo),
  )
  socket.on('ia-error', ({ respondeA, message }: { respondeA: string; message: string }) =>
    useChatStore.getState().setAiError(respondeA, message),
  )
  socket.on('transcripcion-error', ({ idMensaje, message }: { idMensaje: string; message: string }) =>
    useChatStore.getState().setTranscriptionError(idMensaje, message),
  )

  // CU-04: the server picked this client to run what the AI proposed.
  socket.on('ia-propuesta', (payload: unknown, ack?: (result: ProposalAck) => void) => {
    const result = applyProposal(payload)
    if (typeof ack === 'function') ack(result)
  })
  socket.on('votacion', (vote: Vote | null) => useVoteStore.getState().received(vote))

  // CU-05: someone saved a version, the room made an automatic one, or a kept AI change.
  socket.on('version-creada', (version: VersionResumen) => useVersionStore.getState().received(version))
}

/** In the room (again): senders on, and whatever the room is voting on. */
export function roomJoined(socket: Socket, vote: Vote | null, rejoining: boolean): void {
  useChatStore
    .getState()
    .setSender((message: OutgoingMessage) =>
      ackOrFail<SendResult>(socket, 'mensaje', message, 'El servidor no confirmó el mensaje.'),
    )
  useVoteStore
    .getState()
    .setSender((payload) => ackOrFail(socket, 'votar', payload, 'El servidor no confirmó el voto.'))
  useVoteStore.getState().received(vote)

  // Back after a drop: whatever was said, or saved, meanwhile never reached us.
  if (rejoining) {
    void loadLatest()
    if (useVersionStore.getState().loaded) void loadVersions()
  }
}

/** The connection dropped: nothing can be sent, and some answers will never come. */
export function roomDropped(): void {
  useChatStore.getState().setSender(null)
  useVoteStore.getState().setSender(null)
  // The "done" for an AI answer in progress may never arrive now.
  useChatStore.setState({ aiTyping: [] })
}

/** Leaving the project: nothing of this room may show in the next one. */
export function roomClosed(): void {
  useChatStore.getState().setSender(null)
  useVoteStore.getState().reset()
}
