import { useReactFlow } from '@xyflow/react'
import { Crosshair } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useDiagramStore } from '@/state/useDiagramStore'
import {
  initials,
  participantColor,
  STATUS_LABEL,
  type Participant,
  type ParticipantStatus,
} from '@/sync/presence'
import { usePresenceStore } from '@/sync/usePresenceStore'

/**
 * Who is in the room (CU-01): an avatar stack in the header that opens the full
 * list with each person's status. Clicking someone centers the view on them —
 * on their pointer if it is over the diagram, else on what they have selected.
 */

const STATUS_DOT: Record<ParticipantStatus, string> = {
  conectado: 'bg-emerald-500',
  editando: 'bg-sky-500',
  escribiendo: 'bg-amber-500',
  grabando: 'bg-red-500 animate-pulse',
  inactivo: 'bg-slate-300',
  desconectado: 'bg-slate-400',
}

/** More than this and the stack ends in "+N". The list always has everyone. */
const MAX_AVATARS = 4

function Avatar({ participant, size = 'md' }: { participant: Participant; size?: 'sm' | 'md' }) {
  const away = participant.estado === 'desconectado' || participant.estado === 'inactivo'
  const box = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-7 w-7 text-[11px]'

  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={`${box} flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-white ${away ? 'opacity-50 grayscale' : ''}`}
        style={{ backgroundColor: participantColor(participant.idUsuario) }}
      >
        {initials(participant.nombre)}
      </span>
      <span
        className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${STATUS_DOT[participant.estado]}`}
      />
    </span>
  )
}

/** Self first, then everyone else by name; the disconnected sink to the bottom. */
function ordered(participants: Participant[], selfId: string | null): Participant[] {
  return [...participants].sort((a, b) => {
    if (a.idSocket === selfId) return -1
    if (b.idSocket === selfId) return 1

    const aGone = a.estado === 'desconectado' ? 1 : 0
    const bGone = b.estado === 'desconectado' ? 1 : 0
    if (aGone !== bGone) return aGone - bGone

    return a.nombre.localeCompare(b.nombre)
  })
}

export function ParticipantList() {
  const participantsById = usePresenceStore((state) => state.participants)
  const selfId = usePresenceStore((state) => state.selfId)
  const selfStatus = usePresenceStore((state) => state.selfStatus)
  const { setCenter, getZoom, getNodesBounds, getInternalNode } = useReactFlow()

  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const close = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // This client's own status is computed locally; the copy the server holds
  // for us is only what we last told it.
  const participants = ordered(
    Object.values(participantsById).map((p) =>
      p.idSocket === selfId ? { ...p, estado: selfStatus } : p,
    ),
    selfId,
  )

  if (participants.length === 0) return null

  const centerOn = (participant: Participant): void => {
    const options = { zoom: getZoom(), duration: 400 }
    const cursor = usePresenceStore.getState().cursors[participant.idSocket]

    if (cursor) {
      void setCenter(cursor.x, cursor.y, options)
      setOpen(false)
      return
    }

    const ids = participant.seleccion.nodos.filter((id) => getInternalNode(id) !== undefined)

    if (ids.length > 0) {
      const bounds = getNodesBounds(ids)
      void setCenter(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, options)
      setOpen(false)
      return
    }

    useDiagramStore
      .getState()
      .setNotice(`${participant.nombre} no tiene el cursor sobre el diagrama ni nada seleccionado.`)
  }

  const visible = participants.slice(0, MAX_AVATARS)
  const hidden = participants.length - visible.length

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="Personas en este proyecto"
        aria-expanded={open}
        className="flex items-center rounded-full py-0.5 pr-1 pl-0.5 transition-colors hover:bg-slate-100"
      >
        <span className="flex -space-x-1.5">
          {visible.map((participant) => (
            <Avatar key={participant.idSocket} participant={participant} size="sm" />
          ))}
        </span>
        {hidden > 0 && (
          <span className="ml-1 text-[11px] font-medium text-slate-500">+{hidden}</span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-1 w-64 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          <p className="px-3 py-1.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
            En el proyecto · {participants.filter((p) => p.estado !== 'desconectado').length}
          </p>

          <ul>
            {participants.map((participant) => {
              const isSelf = participant.idSocket === selfId
              const canFocus = !isSelf && participant.estado !== 'desconectado'

              return (
                <li key={participant.idSocket}>
                  <button
                    type="button"
                    disabled={!canFocus}
                    onClick={() => centerOn(participant)}
                    title={canFocus ? `Ir a donde está ${participant.nombre}` : undefined}
                    className="group flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors enabled:hover:bg-slate-50"
                  >
                    <Avatar participant={participant} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-slate-700">
                        {participant.nombre}
                        {isSelf && <span className="font-normal text-slate-400"> (vos)</span>}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {STATUS_LABEL[participant.estado]}
                      </span>
                    </span>
                    {canFocus && (
                      <Crosshair className="h-3.5 w-3.5 text-slate-300 group-hover:text-sky-600" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
