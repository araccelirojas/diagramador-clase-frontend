import { Loader2, RefreshCw, Search, Trash2, UserPlus } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { ApiError } from '@/api/client'
import { cancelInvitation, createInvitation, listInvitations } from '@/api/invitations'
import type { Invitacion, Usuario } from '@/api/types'
import { getUser } from '@/api/users'
import { useAuthStore } from '@/auth/useAuthStore'
import { FormError } from '@/ui/auth/FormError'
import { EstadoBadge } from '@/ui/invitations/EstadoBadge'
import { formatFechaInvitacion } from '@/ui/invitations/formatFecha'
import { Modal } from '@/ui/Modal'

/**
 * Inviting someone to collaborate, from inside the editor.
 *
 * The box takes a user UUID, but the backend identifies guests by email
 * (`POST /invitaciones` validates `correo`). So the UUID is resolved through
 * `GET /usuarios/:id` first. That is not a workaround to hide: it is the step
 * that lets the inviter SEE who they are about to invite. A pasted UUID is
 * unreadable, and sending an invitation to the wrong person on a typo, with no
 * confirmation, would be the obvious failure of this screen.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Estado =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; invitaciones: Invitacion[] }

export function InviteModal({
  idProyecto,
  nombreProyecto,
  onClose,
}: {
  idProyecto: string
  nombreProyecto: string
  onClose: () => void
}) {
  const miId = useAuthStore((state) => state.usuario?.idUsuario ?? null)

  const [estado, setEstado] = useState<Estado>({ kind: 'loading' })
  const [intento, setIntento] = useState(0)

  const [uuid, setUuid] = useState('')
  const [encontrado, setEncontrado] = useState<Usuario | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    listInvitations(controller.signal)
      .then((invitaciones) => setEstado({ kind: 'ready', invitaciones }))
      .catch((causa: unknown) => {
        if (causa instanceof DOMException && causa.name === 'AbortError') return

        setEstado({
          kind: 'error',
          message:
            causa instanceof ApiError ? causa.message : 'No se pudieron cargar las invitaciones.',
        })
      })

    return () => controller.abort()
  }, [intento])

  const recargar = useCallback(() => {
    setEstado({ kind: 'loading' })
    setIntento((n) => n + 1)
  }, [])

  const buscar = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (buscando || enviando) return

    const id = uuid.trim()
    setEncontrado(null)
    setError(null)

    if (!UUID_RE.test(id)) {
      setError('Eso no parece un UUID. Copialo del perfil de la persona que querés invitar.')
      return
    }

    if (id === miId) {
      setError('Ese sos vos: no podés invitarte a tu propio proyecto.')
      return
    }

    setBuscando(true)

    try {
      setEncontrado(await getUser(id))
    } catch (causa) {
      setError(
        causa instanceof ApiError && causa.status === 404
          ? 'No existe ningún usuario con ese UUID.'
          : causa instanceof ApiError
            ? causa.message
            : 'No se pudo buscar al usuario.',
      )
    } finally {
      setBuscando(false)
    }
  }

  const invitar = async (): Promise<void> => {
    if (encontrado === null || enviando) return

    setEnviando(true)
    setError(null)

    try {
      await createInvitation(idProyecto, encontrado.correo)
      setUuid('')
      setEncontrado(null)
      recargar()
    } catch (causa) {
      setError(causa instanceof ApiError ? causa.message : 'No se pudo enviar la invitación.')
      setEnviando(false)
      return
    }

    setEnviando(false)
  }

  const cancelar = async (invitacion: Invitacion): Promise<void> => {
    setError(null)

    try {
      await cancelInvitation(invitacion.idInvitacion)
      recargar()
    } catch (causa) {
      setError(causa instanceof ApiError ? causa.message : 'No se pudo cancelar la invitación.')
    }
  }

  // Sent by me = issued on a project I own. The endpoint returns both
  // directions, so the split happens here.
  const enviadas =
    estado.kind === 'ready'
      ? estado.invitaciones.filter((invitacion) => invitacion.proyecto.idUsuario === miId)
      : []

  return (
    <Modal
      title="Invitar a colaborar"
      description={`Proyecto "${nombreProyecto}"`}
      onClose={onClose}
    >
      <form onSubmit={(event) => void buscar(event)} className="mb-4">
        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="invite-uuid">
          UUID del usuario
        </label>

        {/* Closes the loop: the inviter knows what to ask for, and where the
            other person finds it. */}
        <p className="mb-1.5 text-[11px] text-slate-400">
          Pedísela a quien querés invitar: lo tiene en su panel de proyectos.
        </p>

        <div className="flex gap-2">
          <input
            id="invite-uuid"
            value={uuid}
            onChange={(event) => {
              setUuid(event.target.value)
              setEncontrado(null)
            }}
            placeholder="00000000-0000-4000-8000-000000000000"
            disabled={buscando || enviando}
            autoFocus
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 font-mono text-xs text-slate-800 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={buscando || enviando}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {buscando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Buscar
          </button>
        </div>
      </form>

      <FormError message={error} />

      {encontrado !== null && (
        <div className="mb-4 flex items-center gap-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{encontrado.nombre}</p>
            <p className="truncate text-xs text-slate-500">{encontrado.correo}</p>
          </div>

          <button
            type="button"
            onClick={() => void invitar()}
            disabled={enviando}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-sky-700 disabled:bg-sky-300"
          >
            {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            Invitar
          </button>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between border-t border-slate-200 pt-3">
        <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
          Invitaciones que enviaste
        </h3>

        <button
          type="button"
          onClick={recargar}
          className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <RefreshCw className="h-3 w-3" />
          Actualizar
        </button>
      </div>

      {estado.kind === 'loading' && (
        <p className="flex items-center gap-2 py-4 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Cargando…
        </p>
      )}

      {estado.kind === 'error' && <p className="py-4 text-xs text-red-600">{estado.message}</p>}

      {estado.kind === 'ready' && enviadas.length === 0 && (
        <p className="py-4 text-xs text-slate-400 italic">
          Todavía no invitaste a nadie a ninguno de tus proyectos.
        </p>
      )}

      {estado.kind === 'ready' && enviadas.length > 0 && (
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {enviadas.map((invitacion) => (
            <li
              key={invitacion.idInvitacion}
              className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-800">
                  {invitacion.usuario.nombre}
                  {invitacion.idProyecto !== idProyecto && (
                    <span className="font-normal text-slate-400">
                      {' '}
                      · {invitacion.proyecto.nombre}
                    </span>
                  )}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {invitacion.usuario.correo} · {formatFechaInvitacion(invitacion.fechaInvitacion)}
                </p>
              </div>

              <EstadoBadge estado={invitacion.estado} />

              <button
                type="button"
                onClick={() => void cancelar(invitacion)}
                title="Cancelar la invitación"
                className="shrink-0 rounded-sm p-1 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
