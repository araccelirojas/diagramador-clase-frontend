import { ReactFlowProvider } from '@xyflow/react'
import { ArrowLeft, History, Loader2, MessageCircle, SlidersHorizontal, UserPlus, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import type { ProyectoResumen } from '@/api/types'
import { useAuthStore } from '@/auth/useAuthStore'
import { UmlCanvas } from '@/canvas/UmlCanvas'
import { ChatPanel } from '@/chat/ChatPanel'
import { useChatStore } from '@/chat/useChatStore'
import { useVoteStore } from '@/ia/useVoteStore'
import { Inspector } from '@/inspector/Inspector'
import { Palette } from '@/palette/Palette'
import { ExportBackendButton } from '@/ui/ExportBackendButton'
import { InviteModal } from '@/ui/invitations/InviteModal'
import { BotonLlamada } from '@/llamada/BotonLlamada'
import { LlamadaFlotante } from '@/llamada/LlamadaFlotante'
import { ANCHO_PLEGADO, PanelLateral } from '@/ui/PanelLateral'
import { ParticipantList } from '@/sync/ParticipantList'
import { SaveStatus } from '@/sync/SaveStatus'
import type { SaveState } from '@/sync/useAutosave'
import type { CollaborationState } from '@/sync/useCollaboration'
import { useLocalPresence } from '@/sync/useLocalPresence'
import { Toolbar } from '@/ui/Toolbar'
import { VersionsPanel } from '@/versions/VersionsPanel'
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

  // Selection and status out to the room. A no-op while there is no room.
  useLocalPresence()

  /*
   * Plegar los paneles le da el ancho al lienzo. Vive en memoria y no en localStorage a
   * propósito: ahí solo se guarda el token de sesión (CLAUDE.md, "Sesión con JWT").
   */
  const [clasesPlegado, setClasesPlegado] = useState(false)
  const [propiedadesPlegado, setPropiedadesPlegado] = useState(false)

  /** The right panel: the inspector (with the voice agent), the chat, and the version history. */
  const [pestana, setPestana] = useState<'propiedades' | 'chat' | 'versiones'>('propiedades')
  const unread = useChatStore((state) => state.unread)
  // CU-04: a vote in progress lives in the chat; the tab says so from the other one.
  const voting = useVoteStore((state) => state.vote?.estado === 'abierta')

  // Unread counts only while the chat is NOT on screen.
  const chatVisible = pestana === 'chat' && !propiedadesPlegado
  useEffect(() => {
    useChatStore.getState().setVisible(chatVisible)
  }, [chatVisible])

  // The backend refuses an invitation from anyone but the owner, so the button
  // says why instead of failing after the fact.
  const soyDueno = miId !== null && proyecto.idUsuario === miId

  return (
    // Around the whole editor, not just the canvas: the participant list in the
    // header moves the viewport too.
    <ReactFlowProvider>
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

            {collaboration.status === 'reconnecting' && (
              <span
                title="Se cortó la conexión con la sala. Podés seguir editando: los cambios se envían al volver."
                className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-amber-800"
              >
                <WifiOff className="h-3 w-3" />
                Reconectando…
                <Loader2 className="h-3 w-3 animate-spin" />
              </span>
            )}

            {(collaboration.status === 'connected' || collaboration.status === 'reconnecting') && (
              <>
                <ParticipantList />
                {/* The group voice call, with Jarvis inside. */}
                <BotonLlamada />
              </>
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
          {/* Over the canvas, so it stays in view whatever tab the right panel shows. */}
          <LlamadaFlotante />
        </main>

        <PanelLateral
          // Plegado, este título es lo único que se ve: ahí avisa si llegaron mensajes.
          titulo={`${TITULOS[pestana]}${unread > 0 ? ` · ${unread} sin leer` : ''}`}
          lado="derecha"
          plegado={propiedadesPlegado}
          onAlternar={() => setPropiedadesPlegado((valor) => !valor)}
        >
          <div role="tablist" className="mb-3 flex shrink-0 gap-1 rounded-md bg-slate-100 p-0.5">
            <button
              type="button"
              role="tab"
              aria-selected={pestana === 'propiedades'}
              onClick={() => setPestana('propiedades')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-xs transition-colors ${
                pestana === 'propiedades' ? 'bg-white font-medium text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Propiedades
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pestana === 'chat'}
              onClick={() => setPestana('chat')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-xs transition-colors ${
                pestana === 'chat' ? 'bg-white font-medium text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Chat
              {unread > 0 && pestana !== 'chat' && (
                <span className="rounded-full bg-emerald-500 px-1.5 text-[10px] leading-4 font-semibold text-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
              {voting && pestana !== 'chat' && (
                <span className="rounded-full bg-violet-500 px-1.5 text-[10px] leading-4 font-semibold text-white">
                  votación
                </span>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pestana === 'versiones'}
              onClick={() => setPestana('versiones')}
              title="Historial de versiones del diagrama"
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-xs transition-colors ${
                pestana === 'versiones' ? 'bg-white font-medium text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              Versiones
            </button>
          </div>

          {/*
            * Las dos pestañas quedan montadas y solo se ocultan, por lo mismo que el panel
            * plegado: desmontar la de propiedades cortaba la llamada del agente de voz, y la
            * del chat tiene que seguir recibiendo mensajes para contar los no leídos.
            */}
          <div className={pestana === 'propiedades' ? '' : 'hidden'}>
            {/* Arriba del inspector: es lo que se usa sin mirar, y así no hay que buscarlo. */}
            <VozPanel />

            <div className="my-3 border-t border-slate-200" />

            <Inspector />
          </div>

          <div className={pestana === 'chat' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
            <ChatPanel idProyecto={proyecto.idProyecto} />
          </div>

          {/* Mounted only while open: it reloads the list each time, and nothing in it has to keep running. */}
          {pestana === 'versiones' && <VersionsPanel idProyecto={proyecto.idProyecto} />}
        </PanelLateral>
      </div>
    </ReactFlowProvider>
  )
}

const TITULOS = { propiedades: 'Propiedades', chat: 'Chat', versiones: 'Versiones' } as const

export default App
