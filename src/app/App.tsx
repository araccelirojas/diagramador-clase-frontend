import { ArrowLeft, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import type { ProyectoResumen } from '@/api/types'
import { useAuthStore } from '@/auth/useAuthStore'
import { UmlCanvas } from '@/canvas/UmlCanvas'
import { Inspector } from '@/inspector/Inspector'
import { Palette } from '@/palette/Palette'
import { ExportBackendButton } from '@/ui/ExportBackendButton'
import { InviteModal } from '@/ui/invitations/InviteModal'
import { ANCHO_PLEGADO, PanelLateral } from '@/ui/PanelLateral'
import { SaveStatus } from '@/sync/SaveStatus'
import type { SaveState } from '@/sync/useAutosave'
import type { CollaborationState } from '@/sync/useCollaboration'
import { Toolbar } from '@/ui/Toolbar'
import { VozPanel } from '@/voz/VozPanel'

/**
 * General layout: toolbar on top, palette | canvas | inspector below. Both side panels
 * collapse to a narrow strip to give the canvas the room (`PanelLateral`).
 * Holds no business logic; every zone reads what it needs from the store.
 *
 * `EditorPage` mounts it only once the project's document is already in the
 * store, so nothing here has to deal with loading or with a missing diagram.
 */
function App({
  proyecto,
  saveState,
  dirty,
  collaboration,
  flush,
}: {
  proyecto: ProyectoResumen
  saveState: SaveState
  dirty: boolean
  collaboration: CollaborationState
  /** Guarda lo que hay en pantalla; la exportación lee del servidor. */
  flush: () => Promise<void>
}) {
  const miId = useAuthStore((state) => state.usuario?.idUsuario ?? null)
  const [invitando, setInvitando] = useState(false)

  /*
   * Plegar los paneles le da el ancho al lienzo. Vive en memoria y no en localStorage a
   * propósito: ahí solo se guarda el token de sesión (CLAUDE.md, "Sesión con JWT").
   */
  const [clasesPlegado, setClasesPlegado] = useState(false)
  const [propiedadesPlegado, setPropiedadesPlegado] = useState(false)

  // The backend refuses an invitation from anyone but the owner, so the button
  // says why instead of failing after the fact.
  const soyDueno = miId !== null && proyecto.idUsuario === miId

  return (
    <div
      className="grid h-full grid-rows-[3rem_1fr] bg-slate-100 text-slate-800 transition-[grid-template-columns] duration-200 ease-out"
      style={{
        gridTemplateColumns: `${clasesPlegado ? ANCHO_PLEGADO : '14rem'} minmax(0, 1fr) ${
          propiedadesPlegado ? ANCHO_PLEGADO : '20rem'
        }`,
      }}
    >
      <header className="col-span-3 flex min-w-0 items-center gap-2 overflow-hidden border-b border-slate-300 bg-white px-4">
        <Link
          to="/"
          title={`Proyecto: ${proyecto.nombre}`}
          className="flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Proyectos
        </Link>

        <span className="h-4 w-px shrink-0 bg-slate-200" />

        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <Toolbar />
        </div>

        {/*
          * Las acciones del proyecto, pegadas a la derecha y sin encogerse.
          * El `ml-auto` vive aquí y en ningún otro sitio: cuando lo tenía también el
          * contador de la Toolbar, estos botones acababan fuera de la pantalla.
          */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <SaveStatus state={saveState} dirty={dirty} />

          {collaboration.status === 'connected' && collaboration.members > 1 && (
            <span
              title="Personas editando este proyecto ahora mismo"
              className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-emerald-700"
            >
              <Users className="h-3 w-3" />
              {collaboration.members}
            </span>
          )}

          <span className="h-4 w-px shrink-0 bg-slate-200" />

          <ExportBackendButton
            idProyecto={proyecto.idProyecto}
            nombreProyecto={proyecto.nombre}
            onBeforeExport={flush}
          />

          <button
            type="button"
            onClick={() => setInvitando(true)}
            disabled={!soyDueno}
            title={
              soyDueno
                ? 'Invitar a alguien a colaborar en este proyecto'
                : 'Solo el dueño del proyecto puede invitar'
            }
            className="flex shrink-0 items-center gap-1.5 rounded-sm border border-slate-300 px-2 py-1 text-xs whitespace-nowrap text-slate-600 transition-colors hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700 disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-transparent"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Invitar
          </button>
        </div>
      </header>

      {invitando && (
        <InviteModal
          idProyecto={proyecto.idProyecto}
          nombreProyecto={proyecto.nombre}
          onClose={() => setInvitando(false)}
        />
      )}

      <PanelLateral
        titulo="Clases"
        lado="izquierda"
        plegado={clasesPlegado}
        onAlternar={() => setClasesPlegado((valor) => !valor)}
      >
        <Palette />
      </PanelLateral>

      <main className="relative min-w-0 overflow-hidden">
        <UmlCanvas />
      </main>

      <PanelLateral
        titulo="Propiedades"
        lado="derecha"
        plegado={propiedadesPlegado}
        onAlternar={() => setPropiedadesPlegado((valor) => !valor)}
      >
        {/* Arriba del inspector: es lo que se usa sin mirar, y así no hay que buscarlo. */}
        <VozPanel />

        <div className="my-3 border-t border-slate-200" />

        <Inspector />
      </PanelLateral>
    </div>
  )
}

export default App
