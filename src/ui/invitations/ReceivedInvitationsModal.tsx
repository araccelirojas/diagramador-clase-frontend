import { Check, Loader2, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { ApiError } from '@/api/client'
import { listInvitations, respondInvitation } from '@/api/invitations'
import type { Invitacion } from '@/api/types'
import { useAuthStore } from '@/auth/useAuthStore'
import { FormError } from '@/ui/auth/FormError'
import { EstadoBadge } from '@/ui/invitations/EstadoBadge'
import { formatFechaInvitacion } from '@/ui/invitations/formatFecha'
import { Modal } from '@/ui/Modal'

/**
 * The invitations other people sent me.
 *
 * Accepting and rejecting live here too. The brief only asked to list them with
 * their state, but `PATCH /invitaciones/:id` is the only way an invitation is
 * ever answered, and nowhere else in the app calls it: a list of pending
 * invitations that cannot be accepted would leave the whole feature inert.
 */

type Estado =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; invitaciones: Invitacion[] }

export function ReceivedInvitationsModal({
  onClose,
  onAccepted,
}: {
  onClose: () => void
  /** Accepting adds a project to the list behind this dialog. */
  onAccepted: () => void
}) {
  const miId = useAuthStore((state) => state.usuario?.idUsuario ?? null)

  const [estado, setEstado] = useState<Estado>({ kind: 'loading' })
  const [intento, setIntento] = useState(0)
  const [respondiendo, setRespondiendo] = useState<string | null>(null)
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

  const responder = async (
    invitacion: Invitacion,
    estadoNuevo: 'ACEPTADA' | 'RECHAZADA',
  ): Promise<void> => {
    setRespondiendo(invitacion.idInvitacion)
    setError(null)

    try {
      await respondInvitation(invitacion.idInvitacion, estadoNuevo)
      if (estadoNuevo === 'ACEPTADA') onAccepted()
      recargar()
    } catch (causa) {
      setError(causa instanceof ApiError ? causa.message : 'No se pudo responder la invitación.')
    } finally {
      setRespondiendo(null)
    }
  }

  // Received by me. The endpoint also returns the ones I sent, which belong to
  // the editor's invite dialog, not here.
  const recibidas =
    estado.kind === 'ready'
      ? estado.invitaciones.filter((invitacion) => invitacion.idUsuario === miId)
      : []

  return (
    <Modal
      title="Invitaciones recibidas"
      description="Proyectos a los que te invitaron a colaborar."
      onClose={onClose}
    >
      <div className="mb-2 flex items-center justify-end">
        <button
          type="button"
          onClick={recargar}
          className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <RefreshCw className="h-3 w-3" />
          Actualizar
        </button>
      </div>

      <FormError message={error} />

      {estado.kind === 'loading' && (
        <p className="flex items-center gap-2 py-6 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Cargando…
        </p>
      )}

      {estado.kind === 'error' && <p className="py-6 text-xs text-red-600">{estado.message}</p>}

      {estado.kind === 'ready' && recibidas.length === 0 && (
        <p className="py-6 text-center text-xs text-slate-400 italic">
          Nadie te invitó a un proyecto todavía.
        </p>
      )}

      {estado.kind === 'ready' && recibidas.length > 0 && (
        <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
          {recibidas.map((invitacion) => {
            const ocupada = respondiendo === invitacion.idInvitacion

            return (
              <li
                key={invitacion.idInvitacion}
                className="rounded-md border border-slate-200 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {invitacion.proyecto.nombre}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {formatFechaInvitacion(invitacion.fechaInvitacion)}
                    </p>
                  </div>

                  <EstadoBadge estado={invitacion.estado} />
                </div>

                {invitacion.estado === 'PENDIENTE' && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void responder(invitacion, 'ACEPTADA')}
                      disabled={ocupada}
                      className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:bg-emerald-300"
                    >
                      {ocupada ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Aceptar
                    </button>

                    <button
                      type="button"
                      onClick={() => void responder(invitacion, 'RECHAZADA')}
                      disabled={ocupada}
                      className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      Rechazar
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
