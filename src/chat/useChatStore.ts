import { nanoid } from 'nanoid'
import { create } from 'zustand'

import { ApiError } from '@/api/client'
import { listMessages, sendVoiceNote as uploadVoiceNote } from '@/api/mensajes'
import type { Mensaje } from '@/api/types'
import { insertMessage, mentionsAI, mergePage } from '@/chat/messages'
import { serialize } from '@/io/serialize'
import { useDiagramStore } from '@/state/useDiagramStore'
import { resumirDiagrama } from '@/voz/resumen'

/**
 * The room chat (CU-02). Its own store, apart from the diagram's: a message is
 * not a change to `doc`, it never enters the undo history and it never gets
 * near `serialize()` of the document.
 */

/** What goes on the socket's `mensaje` event. */
export type OutgoingMessage = {
  idCliente: string
  texto: string
  /** Only when the text mentions @IA: the diagram as the asker sees it right now. */
  diagrama?: { resumen: string; contenido: unknown }
}

export type SendResult = { ok: true; mensaje: Mensaje } | { ok: false; message: string }

/** Typed but not confirmed by the server yet, or refused. */
export type PendingMessage = {
  idCliente: string
  texto: string
  /** Local clock, only to show a time while it is sending. */
  fecha: string
  status: 'sending' | 'failed'
  error: string | null
  /**
   * A voice note (CU-03). The recording stays here until the server has it, so a
   * failed upload can be retried without recording again.
   */
  voice?: { audio: Blob; duracionMs: number; paraIA: boolean }
}

export type ChatState = {
  idProyecto: string | null
  /** Confirmed messages, oldest first, unique by id. */
  messages: Mensaje[]
  pending: PendingMessage[]
  hasMore: boolean
  loaded: boolean
  loadingOlder: boolean
  loadError: string | null
  /** Questions the AI is answering right now (their `idMensaje`). */
  aiTyping: string[]
  /** Questions the AI could not answer, with the reason. Local, never saved. */
  aiErrors: Record<string, string>
  /** Voice notes whose transcription failed, with the reason (CU-03). */
  transcriptionErrors: Record<string, string>
  /**
   * An AI voice reply to a question THIS user asked, just arrived: its bubble
   * plays it once. Only live arrivals, never history.
   */
  autoplay: string | null
  /** The chat is on screen: nothing counts as unread. */
  visible: boolean
  unread: number
  /** Set while there is a room; null offline. */
  send: ((message: OutgoingMessage) => Promise<SendResult>) | null

  reset: (idProyecto: string) => void
  setSender: (send: ChatState['send']) => void
  setVisible: (visible: boolean) => void
  /**
   * `autoplay: false`: an AI voice reply that plays somewhere else (the voice call),
   * so its bubble must not play it too.
   */
  received: (message: Mensaje, selfId: string | null, options?: { autoplay?: boolean }) => void
  setAiTyping: (respondeA: string, active: boolean) => void
  setAiError: (respondeA: string, message: string) => void
  setTranscriptionError: (idMensaje: string, message: string) => void
  clearAutoplay: () => void
}

export const useChatStore = create<ChatState>()((set) => ({
  idProyecto: null,
  messages: [],
  pending: [],
  hasMore: false,
  loaded: false,
  loadingOlder: false,
  loadError: null,
  aiTyping: [],
  aiErrors: {},
  transcriptionErrors: {},
  autoplay: null,
  visible: false,
  unread: 0,
  send: null,

  reset: (idProyecto) =>
    set({
      idProyecto,
      messages: [],
      pending: [],
      hasMore: false,
      loaded: false,
      loadingOlder: false,
      loadError: null,
      aiTyping: [],
      aiErrors: {},
      transcriptionErrors: {},
      autoplay: null,
      unread: 0,
    }),

  setSender: (send) => set({ send }),

  setVisible: (visible) => set((state) => ({ visible, unread: visible ? 0 : state.unread })),

  received: (message, selfId, options) =>
    set((state) => {
      if (message.idProyecto !== state.idProyecto) return {}

      const isNew = !state.messages.some((m) => m.idMensaje === message.idMensaje)
      const mine = message.usuario !== null && message.usuario.idUsuario === selfId
      const voiceReplyForMe =
        isNew &&
        message.autor === 'IA' &&
        message.tieneAudio &&
        message.mencionA !== null &&
        message.mencionA.idUsuario === selfId &&
        options?.autoplay !== false

      return {
        messages: insertMessage(state.messages, message),
        // The ack and the broadcast race: whichever lands first confirms it.
        pending:
          message.idCliente === null
            ? state.pending
            : state.pending.filter((p) => p.idCliente !== message.idCliente),
        unread: isNew && !mine && !state.visible ? state.unread + 1 : state.unread,
        autoplay: voiceReplyForMe ? message.idMensaje : state.autoplay,
      }
    }),

  setAiTyping: (respondeA, active) =>
    set((state) => ({
      aiTyping: active
        ? [...new Set([...state.aiTyping, respondeA])]
        : state.aiTyping.filter((id) => id !== respondeA),
    })),

  setAiError: (respondeA, message) =>
    set((state) => ({ aiErrors: { ...state.aiErrors, [respondeA]: message } })),

  setTranscriptionError: (idMensaje, message) =>
    set((state) => ({ transcriptionErrors: { ...state.transcriptionErrors, [idMensaje]: message } })),

  clearAutoplay: () => set({ autoplay: null }),
}))

/** What a message says, for a quote or a preview: a voice note by its transcription. */
export function messageText(message: Mensaje): string {
  if (message.tipo !== 'VOZ') return message.texto
  return `🎤 ${message.transcripcion ?? 'Nota de voz'}`
}

/* ------------------------------------------------------------------------ */
/* Actions with side effects: outside the store so it stays plain data.      */
/* ------------------------------------------------------------------------ */

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : 'No se pudo cargar el chat.'
}

/** First page, or a refresh after reconnecting: merges, never wipes. */
export async function loadLatest(signal?: AbortSignal): Promise<void> {
  const { idProyecto } = useChatStore.getState()
  if (idProyecto === null) return

  try {
    const page = await listMessages(idProyecto, { signal })
    if (useChatStore.getState().idProyecto !== idProyecto) return

    useChatStore.setState((state) => ({
      messages: mergePage(state.messages, page.mensajes),
      // A refresh only knows about the newest page: it must not forget that an
      // earlier load had already reached the very beginning.
      hasMore: state.loaded ? state.hasMore : page.hayMas,
      loaded: true,
      loadError: null,
    }))
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    useChatStore.setState({ loadError: errorText(error), loaded: true })
  }
}

/** The page before the oldest message on screen. */
export async function loadOlder(): Promise<void> {
  const state = useChatStore.getState()
  const oldest = state.messages[0]
  if (state.idProyecto === null || !state.hasMore || state.loadingOlder || oldest === undefined) return

  const { idProyecto } = state
  useChatStore.setState({ loadingOlder: true })

  try {
    const page = await listMessages(idProyecto, { antesDe: oldest.idMensaje })
    if (useChatStore.getState().idProyecto !== idProyecto) return

    useChatStore.setState((current) => ({
      messages: mergePage(current.messages, page.mensajes),
      hasMore: page.hayMas,
      loadingOlder: false,
    }))
  } catch (error) {
    useChatStore.setState({ loadingOlder: false, loadError: errorText(error) })
  }
}

/** Sends one pending message, or re-sends a failed one. */
async function deliver(idCliente: string): Promise<void> {
  const state = useChatStore.getState()
  const pending = state.pending.find((p) => p.idCliente === idCliente)
  if (!pending) return

  const update = (patch: Partial<PendingMessage>) =>
    useChatStore.setState((current) => ({
      pending: current.pending.map((p) => (p.idCliente === idCliente ? { ...p, ...patch } : p)),
    }))

  update({ status: 'sending', error: null })

  if (pending.voice) {
    await deliverVoice(idCliente, pending.voice, update)
    return
  }

  if (state.send === null) {
    update({ status: 'failed', error: 'Sin conexión con la sala.' })
    return
  }

  // Taken when it is SENT, not when it was typed: a retry a minute later asks
  // about the diagram as it is now.
  const message: OutgoingMessage = { idCliente, texto: pending.texto }
  if (mentionsAI(pending.texto)) message.diagrama = diagramForAI()

  const result = await state.send(message)

  if (!result.ok) {
    update({ status: 'failed', error: result.message })
    return
  }

  useChatStore.setState((current) => ({
    messages: insertMessage(current.messages, result.mensaje),
    pending: current.pending.filter((p) => p.idCliente !== idCliente),
  }))
}

/** The current diagram, as the AI sees it (CU-02), for a question to @IA (or to Jarvis in the call). */
export function diagramForAI(): { resumen: string; contenido: unknown } {
  const doc = useDiagramStore.getState().doc
  return { resumen: resumirDiagrama(doc), contenido: serialize(doc) }
}

/** Voice notes go up over HTTP (CU-03), not the socket. */
async function deliverVoice(
  idCliente: string,
  voice: NonNullable<PendingMessage['voice']>,
  update: (patch: Partial<PendingMessage>) => void,
): Promise<void> {
  const { idProyecto } = useChatStore.getState()
  if (idProyecto === null) return

  try {
    const { mensaje } = await uploadVoiceNote(idProyecto, {
      audio: voice.audio,
      idCliente,
      duracionMs: voice.duracionMs,
      paraIA: voice.paraIA,
      ...(voice.paraIA ? { diagrama: diagramForAI() } : {}),
    })

    useChatStore.setState((current) => ({
      messages: insertMessage(current.messages, mensaje),
      pending: current.pending.filter((p) => p.idCliente !== idCliente),
    }))
  } catch (error) {
    update({
      status: 'failed',
      error: error instanceof ApiError ? error.message : 'No se pudo enviar la nota de voz.',
    })
  }
}

export function sendVoiceNote(audio: Blob, duracionMs: number, paraIA: boolean): void {
  const idCliente = `v_${nanoid(12)}`

  useChatStore.setState((state) => ({
    pending: [
      ...state.pending,
      {
        idCliente,
        texto: '',
        fecha: new Date().toISOString(),
        status: 'sending',
        error: null,
        voice: { audio, duracionMs, paraIA },
      },
    ],
  }))

  void deliver(idCliente)
}

export function sendChatMessage(texto: string): void {
  const clean = texto.trim()
  if (clean === '') return

  const idCliente = `c_${nanoid(12)}`

  useChatStore.setState((state) => ({
    pending: [
      ...state.pending,
      { idCliente, texto: clean, fecha: new Date().toISOString(), status: 'sending', error: null },
    ],
  }))

  void deliver(idCliente)
}

export function retryChatMessage(idCliente: string): void {
  void deliver(idCliente)
}

export function discardChatMessage(idCliente: string): void {
  useChatStore.setState((state) => ({
    pending: state.pending.filter((p) => p.idCliente !== idCliente),
  }))
}
