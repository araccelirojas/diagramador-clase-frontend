import { AlertCircle, Clock, CornerDownRight, Mic, RotateCw, Sparkles, X } from 'lucide-react'

import type { Mensaje } from '@/api/types'
import { formatDuration, splitMentions, timeLabel } from '@/chat/messages'
import { messageText, type PendingMessage } from '@/chat/useChatStore'
import { VoicePlayer } from '@/chat/VoicePlayer'
import { participantColor } from '@/sync/presence'

/**
 * One chat bubble (CU-02). WhatsApp layout: mine on the right, everyone else on
 * the left with their name in their room color, the AI in violet.
 */

function Text({ text, onDark }: { text: string; onDark: boolean }) {
  return (
    <p className="text-[13px] leading-snug break-words whitespace-pre-wrap">
      {splitMentions(text).map((part, index) =>
        part.mention ? (
          <span key={index} className={`font-semibold ${onDark ? 'text-violet-100' : 'text-violet-700'}`}>
            {part.text}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  )
}

/** What goes inside a bubble: the text, or the player of a voice note (CU-03). */
function Body({ message, onDark }: { message: Mensaje; onDark: boolean }) {
  return message.tipo === 'VOZ' && message.tieneAudio ? (
    <VoicePlayer message={message} onDark={onDark} />
  ) : (
    <Text text={messageText(message)} onDark={onDark} />
  )
}

/** The question an AI reply answers, quoted on top so the thread reads on its own. */
function Quote({ question }: { question: Mensaje }) {
  return (
    <div className="mb-1 flex items-start gap-1 rounded-sm border-l-2 border-violet-300 bg-white/70 px-1.5 py-1 text-[11px] text-slate-500">
      <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0" />
      <span className="line-clamp-2">
        <span className="font-medium text-slate-600">{question.usuario?.nombre ?? 'Alguien'}:</span>{' '}
        {messageText(question)}
      </span>
    </div>
  )
}

export function MessageBubble({
  message,
  mine,
  showAuthor,
  question,
  forMe,
}: {
  message: Mensaje
  mine: boolean
  /** False for the second and later bubbles in a row from the same author. */
  showAuthor: boolean
  /** For an AI reply: the message it answers, if it is loaded. */
  question: Mensaje | undefined
  /** An AI reply to a question THIS user asked: highlighted. */
  forMe: boolean
}) {
  if (message.autor === 'IA') {
    return (
      <div className="flex justify-start">
        <div
          className={`max-w-[88%] rounded-lg rounded-tl-sm border px-2.5 py-1.5 text-slate-800 shadow-xs ${
            forMe ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-300' : 'border-violet-200 bg-violet-50/60'
          }`}
        >
          <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-violet-700">
            <Sparkles className="h-3 w-3" />
            IA
            {forMe ? (
              <span className="font-normal text-violet-500">· te responde a vos</span>
            ) : message.mencionA ? (
              <span className="font-normal text-violet-400">· para {message.mencionA.nombre}</span>
            ) : null}
          </p>
          {question ? <Quote question={question} /> : null}
          <Body message={message} onDark={false} />
          <p className="mt-0.5 text-right text-[10px] text-slate-400">{timeLabel(message.fecha)}</p>
        </div>
      </div>
    )
  }

  const author = message.usuario

  if (mine) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg rounded-tr-sm bg-sky-600 px-2.5 py-1.5 text-white shadow-xs">
          <Body message={message} onDark />
          <p className="mt-0.5 text-right text-[10px] text-sky-100">{timeLabel(message.fecha)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-lg rounded-tl-sm border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 shadow-xs">
        {showAuthor && (
          <p
            className="mb-0.5 text-[11px] font-semibold"
            style={{ color: author ? participantColor(author.idUsuario) : '#64748b' }}
          >
            {author?.nombre ?? 'Usuario eliminado'}
          </p>
        )}
        <Body message={message} onDark={false} />
        <p className="mt-0.5 text-right text-[10px] text-slate-400">{timeLabel(message.fecha)}</p>
      </div>
    </div>
  )
}

/** Mine, not confirmed yet: "enviando…", or "no enviado" with retry. */
export function PendingBubble({
  pending,
  onRetry,
  onDiscard,
}: {
  pending: PendingMessage
  onRetry: () => void
  onDiscard: () => void
}) {
  const failed = pending.status === 'failed'

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div
        className={`max-w-[85%] rounded-lg rounded-tr-sm px-2.5 py-1.5 shadow-xs ${
          failed ? 'border border-red-200 bg-red-50 text-red-900' : 'bg-sky-600/70 text-white'
        }`}
      >
        {pending.voice ? (
          <p className="flex items-center gap-1.5 text-[13px]">
            <Mic className="h-3.5 w-3.5" />
            Nota de voz · {formatDuration(pending.voice.duracionMs)}
            {pending.voice.paraIA && <span className="text-[11px] opacity-80">· para la IA</span>}
          </p>
        ) : (
          <Text text={pending.texto} onDark={!failed} />
        )}
        {!failed && (
          <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-sky-100">
            <Clock className="h-2.5 w-2.5" />
            Enviando…
          </p>
        )}
      </div>

      {failed && (
        <div className="flex items-center gap-2 text-[11px]">
          <span className="flex items-center gap-1 text-red-600" title={pending.error ?? undefined}>
            <AlertCircle className="h-3 w-3" />
            No enviado
          </span>
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-0.5 font-medium text-sky-700 hover:underline"
          >
            <RotateCw className="h-3 w-3" />
            Reintentar
          </button>
          <button
            type="button"
            onClick={onDiscard}
            title="Descartar"
            aria-label="Descartar mensaje"
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}
