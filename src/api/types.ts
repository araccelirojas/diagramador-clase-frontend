/**
 * Shapes returned by the backend, mirrored from `diagramador-backend`'s Prisma
 * schema and its `publicFields` selection. Keys stay in Spanish because they
 * are the API's, not ours: renaming them here would create a second vocabulary
 * and a translation layer that can drift.
 */

export type Usuario = {
  idUsuario: string
  nombre: string
  correo: string
  /** ISO timestamp. */
  fechaRegistro: string
  estado: boolean
}

/** What `proyecto.repository` includes for the owner of a project. */
export type UsuarioResumen = Pick<Usuario, 'idUsuario' | 'nombre' | 'correo'>

export type Proyecto = {
  idProyecto: string
  nombre: string
  /** The whole diagram (CLAUDE.md §5). `unknown` on purpose: only `io/` validates it. */
  contenido: unknown
  /** ISO timestamp. */
  fechaCreacion: string
  /** Owner. Differs from the session user when the project arrived by invitation. */
  idUsuario: string
  usuario: UsuarioResumen
}

/**
 * The listing must not depend on `contenido` (CLAUDE.md §10): it would download
 * megabytes nobody is going to look at. Today the backend still sends it, so we
 * drop it in the type to keep the screen honest.
 */
export type ProyectoResumen = Omit<Proyecto, 'contenido'>

/** `POST /auth/login` and `POST /auth/registro`. */
export type Sesion = {
  token: string
  usuario: Usuario
}

/** `GET /proyectos/:id/contenido`. */
export type ContenidoProyecto = {
  idProyecto: string
  contenido: unknown
}
