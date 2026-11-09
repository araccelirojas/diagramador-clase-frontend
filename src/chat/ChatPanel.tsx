import { AlertCircle, Loader2, MessagesSquare, Mic, Sparkles } from 'lucide-react'
import { Fragment, useEffect, useLayoutEffect, useRef } from 'react'

import { useAuthStore } from '@/auth/useAuthStore'
import { clearAudioCache } from '@/chat/audioCache'
import { ChatComposer } from '@/chat/ChatComposer'
import { dayKey, dayLabel, typingLabel } from '@/chat/messages'
import { MessageBubble, PendingBubble } from '@/chat/MessageBubble'
import {
  discardChatMessage,
  loadLatest,
  loadOlder,
  retryChatMessage,
  useChatStore,
} from '@/chat/useChatStore'
import { VoteBar } from '@/chat/VoteBar'
import { usePresenceStore } from '@/sync/usePresenceStore'

/**
 * The room chat (CU-02): the whole conversation of the project, shared by
 * everyone with access, with the AI answering whoever mentions @IA.
 *
 * Scrolling up to the top loads the previous page, and the view stays where it
 * was instead of jumping to the newly loaded messages.
 */

/** This close to the bottom counts as "reading the latest": new messages scroll in. */
const STICK_TO_BOTTOM_PX = 80
/** This close to the top starts loading older messages. */
const LOAD_OLDER_PX = 60

export function ChatPanel({ idProyecto }: { idProyecto: string }) {
  const messages = useChatStore((state) => state.messages)
  const pending = useChatStore((state) => state.pending)
  const hasMore = useChatStore((state) => state.hasMore)
  const loaded = useChatStore((state) => state.loaded)
  const loadingOlder = useChatStore((state) => state.loadingOlder)
  const loadError = useChatStore((state) => state.loadError)
  const aiTyping = useChatStore((state) => state.aiTyping)
  const aiErrors = useChatStore((state) => state.aiErrors)

  const myId = useAuthStore((state) => state.usuario?.idUsuario ?? null)
  const participants = usePresenceStore((state) => state.participants)
  const selfId = usePresenceStore((state) => state.selfId)

  useEffect(() => {
    useChatStore.getState().reset(idProyecto)
    const controller = new AbortController()
    void loadLatest(controller.signal)
    return () => {
      controller.abort()
      clearAudioCache()
    }
  }, [idProyecto])

  /* Scroll ---------------------------------------------------------------- */

  const listRef = useRef<HTMLDivElement>(null)
  /** Scroll position bookkeeping of the DOM, not a mirror of the store. */
  const scrollRef = useRef({ first: undefined as string | undefined, count: 0, height: 0, nearBottom: true })

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return

    const previous = scrollRef.current
    const first = messages[0]?.idMensaje
    const count = messages.length + pending.length

    const prepended =
      previous.first !== undefined &&
      first !== previous.first &&
      messages.some((m) => m.idMensaje === previous.first)

    if (prepended) {
      // Older history went in above: keep the same message under the eyes.
      list.scrollTop += list.scrollHeight - previous.height
    } else if (count > previous.count && (previous.nearBottom || pending.length > 0)) {
      list.scrollTop = list.scrollHeight
    }

    scrollRef.current = { ...previous, first, count, height: list.scrollHeight }
  }, [messages, pending])

  // The "escribiendo…" line appearing must not hide the last message.
  useLayoutEffect(() => {
    const list = listRef.current
    if (list && scrollRef.current.nearBottom) list.scrollTop = list.scrollHeight
  }, [aiTyping.length, participants])

  const onScroll = (): void => {
    const list = listRef.current
    if (!list) return

    scrollRef.current.nearBottom =
      list.scrollHeight - list.scrollTop - list.clientHeight < STICK_TO_BOTTOM_PX
    scrollRef.current.height = list.scrollHeight

    if (list.scrollTop < LOAD_OLDER_PX) void loadOlder()
  }

  /* Who is typing --------------------------------------------------------- */

  const others = Object.values(participants).filter((p) => p.idSocket !== selfId)
  const typing = typingLabel(others.filter((p) => p.estado === 'escribiendo').map((p) => p.nombre))
  const recordingLabel = typingLabel(
    others.filter((p) => p.estado === 'grabando').map((p) => p.nombre),
    'grabando',
  )

  const byId = new Map(messages.map((m) => [m.idMensaje, m]))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={listRef} onScroll={onScroll} className="-mx-1 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-1 pb-2">
        {hasMore && (
          <div className="flex justify-center py-1">
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-sky-700"
            >
              {loadingOlder && <Loader2 className="h-3 w-3 animate-spin" />}
              {loadingOlder ? 'Cargando…' : 'Ver mensajes anteriores'}
            </button>
          </div>
        )}

        {!loaded && (
          <p className="flex items-center justify-center gap-1.5 py-6 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Cargando el chat…
          </p>
        )}

        {loadError && (
          <p className="flex items-center gap-1.5 rounded-sm bg-red-50 px-2 py-1 text-[11px] text-red-700">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {loadError}
          </p>
        )}

        {loaded && messages.length === 0 && pending.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-xs text-slate-400">
            <MessagesSquare className="h-6 w-6" />
            <p>Todavía no hay mensajes. Escribí algo, o mencioná a @IA para preguntarle sobre el diagrama.</p>
          </div>
        )}

        {messages.map((message, index) => {
          const previous = messages[index - 1]
          const newDay = previous === undefined || dayKey(previous.fecha) !== dayKey(message.fecha)
          const sameAuthor =
            !newDay &&
            previous !== undefined &&
            previous.autor === message.autor &&
            previous.usuario?.idUsuario === message.usuario?.idUsuario

          const aiError = aiErrors[message.idMensaje]

          return (
            <Fragment key={message.idMensaje}>
              {newDay && (
                <div className="flex justify-center py-1">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    {dayLabel(message.fecha)}
                  </span>
                </div>
              )}

              <MessageBubble
                message={message}
                mine={message.autor === 'USUARIO' && message.usuario?.idUsuario === myId}
                showAuthor={!sameAuthor}
                question={message.respondeA === null ? undefined : byId.get(message.respondeA)}
                forMe={message.autor === 'IA' && message.mencionA?.idUsuario === myId}
              />

              {aiError && (
                <p className="flex items-center gap-1 px-1 text-[11px] text-red-600">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  La IA no pudo responder: {aiError}
                </p>
              )}
            </Fragment>
          )
        })}

        {pending.map((item) => (
          <PendingBubble
            key={item.idCliente}
            pending={item}
            onRetry={() => retryChatMessage(item.idCliente)}
            onDiscard={() => discardChatMessage(item.idCliente)}
          />
        ))}
      </div>

      <div className="min-h-4 space-y-0.5 px-1 py-0.5 text-[11px] text-slate-500 italic">
        {aiTyping.length > 0 && (
          <p className="flex items-center gap-1 text-violet-600">
            <Sparkles className="h-3 w-3 animate-pulse" />
            La IA está escribiendo…
          </p>
        )}
        {recordingLabel && (
          <p className="flex items-center gap-1 text-red-600">
            <Mic className="h-3 w-3 animate-pulse" />
            {recordingLabel}
          </p>
        )}
        {typing && <p>{typing}</p>}
      </div>

      {/* CU-04: pinned while the room votes on an AI change, wherever the list is scrolled. */}
      <VoteBar />
      <ChatComposer />
    </div>
  )
}
