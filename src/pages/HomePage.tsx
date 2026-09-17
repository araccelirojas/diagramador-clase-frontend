import { FilePlus2, FolderOpen, Loader2, LogOut, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError } from '@/api/client'
import { createProject, listProjects } from '@/api/projects'
import type { ProyectoResumen } from '@/api/types'
import { useAuthStore } from '@/auth/useAuthStore'
import { FormError } from '@/ui/auth/FormError'
import { ProjectCard } from '@/ui/home/ProjectCard'

/**
 * The projects of whoever is logged in: owned ones plus those reached through
 * an accepted invitation, which is exactly what `GET /proyectos` returns.
 *
 * Loading, failure and emptiness are three different screens on purpose. A
 * spinner that never resolves and an empty list look identical otherwise, and
 * the user cannot tell "you have no projects" from "the backend is down".
 */

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

  return (
    <div className="min-h-full bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
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
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {estado.kind === 'ready'
              ? `${estado.proyectos.length} ${estado.proyectos.length === 1 ? 'proyecto' : 'proyectos'}`
              : ''}
          </p>

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
              onClick={() => {
                setEstado({ kind: 'loading' })
                setIntento((n) => n + 1)
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reintentar
            </button>
          </div>
        )}

        {estado.kind === 'ready' && estado.proyectos.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
            <FolderOpen className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">Todavía no tienes proyectos</p>
            <p className="mt-1 text-xs text-slate-500">
              Crea el primero y el lienzo se abre en blanco, listo para diagramar.
            </p>
          </div>
        )}

        {estado.kind === 'ready' && estado.proyectos.length > 0 && (
          <ul className="flex flex-col gap-2">
            {estado.proyectos.map((proyecto) => (
              <li key={proyecto.idProyecto}>
                <ProjectCard
                  proyecto={proyecto}
                  idUsuarioSesion={usuario?.idUsuario ?? null}
                  onOpen={() => openProject(proyecto.idProyecto)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
