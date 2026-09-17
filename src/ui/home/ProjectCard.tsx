import { ChevronRight, Users } from 'lucide-react'

import type { ProyectoResumen } from '@/api/types'

const FECHA = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })

function formatFecha(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : FECHA.format(date)
}

/**
 * One project. Clicking it opens the editor, which is why the whole card is a
 * button and not a div with an onClick: keyboard and screen readers get it free.
 */
export function ProjectCard({
  proyecto,
  idUsuarioSesion,
  onOpen,
}: {
  proyecto: ProyectoResumen
  idUsuarioSesion: string | null
  onOpen: () => void
}) {
  // The listing also returns projects reached through an accepted invitation.
  const esCompartido = idUsuarioSesion !== null && proyecto.idUsuario !== idUsuarioSesion

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-sky-400 hover:bg-sky-50/40 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-sm font-medium text-slate-800">{proyecto.nombre}</h2>

          {esCompartido && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              <Users className="h-3 w-3" />
              Compartido
            </span>
          )}
        </div>

        <p className="mt-1 truncate text-xs text-slate-500">
          {esCompartido ? `De ${proyecto.usuario.nombre}` : 'Tuyo'} · Creado el{' '}
          {formatFecha(proyecto.fechaCreacion)}
        </p>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-sky-500" />
    </button>
  )
}
