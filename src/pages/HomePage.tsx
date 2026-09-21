import { FilePlus2, FolderOpen, ImageUp, Loader2, LogOut, Mail, RefreshCw, Users } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError } from '@/api/client'
import { createProject, listProjects } from '@/api/projects'
import type { ProyectoResumen } from '@/api/types'
import { useAuthStore } from '@/auth/useAuthStore'
import { FormError } from '@/ui/auth/FormError'
import { ProjectCard } from '@/ui/home/ProjectCard'
import { ImportSketchDialog } from '@/ui/home/ImportSketchDialog'
import { UuidCard } from '@/ui/home/UuidCard'
import { ReceivedInvitationsModal } from '@/ui/invitations/ReceivedInvitationsModal'

/**
 * The projects of whoever is logged in: owned ones plus those reached through
 * an accepted invitation, which is exactly what `GET /proyectos` returns.
 *
 * Loading, failure and emptiness are three different screens on purpose. A
 * spinner that never resolves and an empty list look identical otherwise, and
 * the user cannot tell "you have no projects" from "the backend is down".
 */

const SECTION_TITLE =
  'flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-400 uppercase'

const COUNT = 'rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600'

type Estado =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; proyectos: ProyectoResumen[] }

export function HomePage() {
  const navigate = useNavigate()
  const usuario = useAuthStore((state) => state.usuario)
  const signOut = useAuthStore((state) => state.signOut)

  const [estado, setEstado] = useState<Estado>({ kind: 'loading' })
  /** Bumped by the retry button to re-run the effect. */
  const [intento, setIntento] = useState(0)

  const [viendoInvitaciones, setViendoInvitaciones] = useState(false)
  const [importandoBoceto, setImportandoBoceto] = useState(false)
  const [creando, setCreando] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [pendingCreate, setPendingCreate] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    // Going back to `loading` is the retry button's job, not this effect's: a
    // setState run synchronously on mount only costs an extra render.
    listProjects(controller.signal)
      .then((proyectos) => setEstado({ kind: 'ready', proyectos }))
      .catch((error: unknown) => {
        // StrictMode mounts twice in dev; the aborted first run is not a failure.
        if (error instanceof DOMException && error.name === 'AbortError') return

        setEstado({
          kind: 'error',
          message: error instanceof ApiError ? error.message : 'No se pudieron cargar los proyectos.',
        })
      })

    return () => controller.abort()
  }, [intento])

  const recargarProyectos = useCallback(() => {
    setEstado({ kind: 'loading' })
    setIntento((n) => n + 1)
  }, [])

  const openProject = useCallback(
    (idProyecto: string) => navigate(`/proyectos/${idProyecto}`),
    [navigate],
  )

  const submitCreate = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (pendingCreate) return

    const nombre = nombreNuevo.trim()

    if (nombre === '') {
      setCreateError('Escribe un nombre para el proyecto.')
      return
    }

    setPendingCreate(true)
    setCreateError(null)

    try {
      const proyecto = await createProject(nombre)
      // Straight into the editor: a project you just named is one you want to draw.
      openProject(proyecto.idProyecto)
    } catch (error) {
      setCreateError(error instanceof ApiError ? error.message : 'No se pudo crear el proyecto.')
      setPendingCreate(false)
    }
  }

  const miId = usuario?.idUsuario ?? null
  const proyectos = estado.kind === 'ready' ? estado.proyectos : []

  // `GET /proyectos` mixes both: the ones I own and the ones I reached through
  // an accepted invitation. The owner id is what tells them apart.
  const propios = proyectos.filter((proyecto) => proyecto.idUsuario === miId)
  const invitados = proyectos.filter((proyecto) => proyecto.idUsuario !== miId)

  return (
    <div className="min-h-full bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-widest text-sky-600 uppercase">
                Diagramador UML
              </p>
              <h1 className="truncate text-lg font-semibold text-slate-800">
                {usuario === null ? 'Mis proyectos' : `Proyectos de ${usuario.nombre}`}
              </h1>
            </div>

            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <LogOut className="h-3.5 w-3.5" />
              Cerrar sesión
            </button>
          </div>

          {usuario !== null && <UuidCard idUsuario={usuario.idUsuario} />}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {creando && (
          <form
            onSubmit={(event) => void submitCreate(event)}
            className="mb-4 rounded-lg border border-slate-200 bg-white p-4"
          >
            <FormError message={createError} />

            <div className="flex gap-2">
              <input
                value={nombreNuevo}
                onChange={(event) => setNombreNuevo(event.target.value)}
                placeholder="Nombre del proyecto"
                disabled={pendingCreate}
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50"
              />
              <button
                type="submit"
                disabled={pendingCreate}
                className="flex shrink-0 items-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:bg-sky-300"
              >
                {pendingCreate && <Loader2 className="h-4 w-4 animate-spin" />}
                Crear y abrir
              </button>
            </div>
          </form>
        )}

        {estado.kind === 'loading' && (
          <p className="flex items-center gap-2 py-12 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando proyectos…
          </p>
        )}

        {estado.kind === 'error' && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-700">{estado.message}</p>
            <button
              type="button"
              onClick={recargarProyectos}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reintentar
            </button>
          </div>
        )}

        {estado.kind === 'ready' && (
          <>
            <section className="mb-8">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className={SECTION_TITLE}>
                  Mis proyectos <span className={COUNT}>{propios.length}</span>
                </h2>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setImportandoBoceto(true)}
                    title="Reconstruir un diagrama a partir de una foto"
                    className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700"
                  >
                    <ImageUp className="h-3.5 w-3.5" />
                    Importar boceto
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCreando((abierto) => !abierto)
                      setCreateError(null)
                    }}
                    className="flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sky-700"
                  >
                    <FilePlus2 className="h-3.5 w-3.5" />
                    Nuevo proyecto
                  </button>
                </div>
              </div>

              {propios.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
                  <FolderOpen className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-medium text-slate-700">
                    Todavía no tienes proyectos
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Crea el primero y el lienzo se abre en blanco, listo para diagramar.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {propios.map((proyecto) => (
                    <li key={proyecto.idProyecto}>
                      <ProjectCard
                        proyecto={proyecto}
                        idUsuarioSesion={miId}
                        onOpen={() => openProject(proyecto.idProyecto)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className={SECTION_TITLE}>
                  Proyectos invitados <span className={COUNT}>{invitados.length}</span>
                </h2>

                <button
                  type="button"
                  onClick={() => setViendoInvitaciones(true)}
                  className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Invitaciones
                </button>
              </div>

              {invitados.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
                  <Users className="mx-auto h-7 w-7 text-slate-300" />
                  <p className="mt-3 text-sm font-medium text-slate-700">
                    No colaboras en ningún proyecto ajeno
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Un proyecto aparece acá cuando aceptas la invitación de su dueño.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {invitados.map((proyecto) => (
                    <li key={proyecto.idProyecto}>
                      <ProjectCard
                        proyecto={proyecto}
                        idUsuarioSesion={miId}
                        onOpen={() => openProject(proyecto.idProyecto)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      {importandoBoceto && (
        <ImportSketchDialog
          onClose={() => setImportandoBoceto(false)}
          onCreado={(idProyecto) => openProject(idProyecto)}
        />
      )}

      {viendoInvitaciones && (
        <ReceivedInvitationsModal
          onClose={() => setViendoInvitaciones(false)}
          // Accepting grants access to a project, so the list behind has to catch up.
          onAccepted={recargarProyectos}
        />
      )}
    </div>
  )
}
