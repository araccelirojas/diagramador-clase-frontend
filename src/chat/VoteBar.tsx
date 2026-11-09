import { Check, ChevronDown, ChevronUp, Sparkles, Vote as VoteIcon, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useAuthStore } from '@/auth/useAuthStore'
import { formatDuration } from '@/chat/messages'
import { castVote, myVote, useVoteStore, type Vote, type VoteChoice } from '@/ia/useVoteStore'

/**
 * The vote on the AI's change, pinned above the composer while it lasts
 * (CU-04): what changed, how many voted each way, who is missing and how much
 * time is left. Voting here is the same as answering "sí" or "no" in the chat.
 */

/** Past this many changes the list folds; the canvas shows them all anyway. */
const FOLDED_CHANGES = 3

function useSecondsTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

function names(list: { nombre: string }[]): string {
  return list.map((v) => v.nombre).join(', ')
}

function Outcome({ vote }: { vote: Vote }) {
  const kept = vote.estado === 'conservada'
  const how =
    vote.motivo === 'desempate'
      ? ' (desempató quien pidió el cambio)'
      : vote.motivo === 'sin-votos'
        ? ' (nadie votó)'
        : ''

  return (
    <p className={`flex items-center gap-1 font-medium ${kept ? 'text-emerald-700' : 'text-slate-600'}`}>
      {kept ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      {kept ? 'Se conservan los cambios de la IA' : 'Se descartaron los cambios de la IA'}
      <span className="font-normal text-slate-500">{how}</span>
    </p>
  )
}

function VoteButton({
  choice,
  mine,
  onVote,
}: {
  choice: VoteChoice
  mine: VoteChoice | null
  onVote: (choice: VoteChoice) => void
}) {
  const keep = choice === 'conservar'
  const chosen = mine === choice
  const base = keep
    ? chosen
      ? 'border-emerald-600 bg-emerald-600 text-white'
      : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
    : chosen
      ? 'border-slate-600 bg-slate-600 text-white'
      : 'border-slate-300 text-slate-600 hover:bg-slate-100'

  return (
    <button
      type="button"
      onClick={() => onVote(choice)}
      aria-pressed={chosen}
      className={`flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1 text-[12px] font-medium transition-colors ${base}`}
    >
      {keep ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      {keep ? 'Conservar' : 'Descartar'}
    </button>
  )
}

export function VoteBar() {
  const vote = useVoteStore((state) => state.vote)
  const deadline = useVoteStore((state) => state.deadline)
  const error = useVoteStore((state) => state.error)
  const myId = useAuthStore((state) => state.usuario?.idUsuario ?? null)
  const [unfolded, setUnfolded] = useState(false)

  const open = vote?.estado === 'abierta'
  const now = useSecondsTick(open)

  if (!vote) return null

  const mine = myVote(vote, myId)
  const keep = vote.votos.filter((v) => v.voto === 'conservar')
  const discard = vote.votos.filter((v) => v.voto === 'descartar')
  const left = deadline === null ? 0 : Math.max(0, deadline - now)
  const changes = unfolded ? vote.cambios : vote.cambios.slice(0, FOLDED_CHANGES)
  const hidden = vote.cambios.length - changes.length

  return (
    <div
      role="region"
      aria-label="Votación de los cambios de la IA"
      className="mb-2 space-y-1.5 rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-2 text-[12px] text-slate-700"
    >
      <p className="flex items-center gap-1 font-semibold text-violet-700">
        <Sparkles className="h-3.5 w-3.5" />
        Cambios de la IA
        {vote.solicitante && (
          <span className="font-normal text-violet-500">· pedidos por {vote.solicitante.nombre}</span>
        )}
        {open && (
          <span className="ml-auto flex items-center gap-1 font-normal text-violet-600 tabular-nums">
            <VoteIcon className="h-3 w-3" />
            {formatDuration(left)}
          </span>
        )}
      </p>

      {vote.cambios.length > 0 && (
        <ul className="space-y-0.5 pl-1 text-[11px] text-slate-600">
          {changes.map((line, index) => (
            <li key={index} className="before:mr-1 before:text-violet-400 before:content-['•']">
              {line}
            </li>
          ))}
          {(hidden > 0 || unfolded) && vote.cambios.length > FOLDED_CHANGES && (
            <li>
              <button
                type="button"
                onClick={() => setUnfolded((value) => !value)}
                className="flex items-center gap-0.5 text-violet-600 hover:underline"
              >
                {unfolded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {unfolded ? 'Ver menos' : `Ver ${hidden} más`}
              </button>
            </li>
          )}
        </ul>
      )}

      <p className="flex flex-wrap gap-x-3 text-[11px]">
        <span className="text-emerald-700" title={names(keep)}>
          ✔ {keep.length} conservar
        </span>
        <span className="text-slate-600" title={names(discard)}>
          ✖ {discard.length} descartar
        </span>
        {open && vote.faltantes.length > 0 && (
          <span className="text-slate-500">Faltan: {names(vote.faltantes)}</span>
        )}
      </p>

      {open ? (
        <>
          <div className="flex gap-1.5">
            <VoteButton choice="conservar" mine={mine} onVote={(c) => void castVote(c)} />
            <VoteButton choice="descartar" mine={mine} onVote={(c) => void castVote(c)} />
          </div>
          <p className="text-[10px] text-slate-500">
            {mine
              ? 'Podés cambiar tu voto hasta que cierre.'
              : 'También vale responder «sí» o «no» en el chat, escrito o en una nota de voz.'}
          </p>
        </>
      ) : (
        <Outcome vote={vote} />
      )}

      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  )
}
