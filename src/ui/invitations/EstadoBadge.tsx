import type { EstadoInvitacion } from '@/api/types'

/** The three states of `EstadoInvitacion`, read at a glance. */

const STYLES: Record<EstadoInvitacion, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700',
  ACEPTADA: 'bg-emerald-100 text-emerald-700',
  RECHAZADA: 'bg-rose-100 text-rose-700',
}

const LABELS: Record<EstadoInvitacion, string> = {
  PENDIENTE: 'Pendiente',
  ACEPTADA: 'Aceptada',
  RECHAZADA: 'Rechazada',
}

export function EstadoBadge({ estado }: { estado: EstadoInvitacion }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STYLES[estado]}`}
    >
      {LABELS[estado]}
    </span>
  )
}
