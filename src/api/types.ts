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

/** `EstadoInvitacion` in the Prisma schema. */
export type EstadoInvitacion = 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA'

/**
 * `GET /invitaciones` returns both directions at once: the ones addressed to
 * me, and the ones issued on projects I own. They are told apart by comparing
 * `idUsuario` (the recipient) and `proyecto.idUsuario` (the owner) against the
 * session user — the backend cannot be asked for one side only.
 */
export type Invitacion = {
  idInvitacion: string
  estado: EstadoInvitacion
  /** ISO timestamp. */
  fechaInvitacion: string
  /** The recipient. */
  idUsuario: string
  usuario: UsuarioResumen
  idProyecto: string
  proyecto: {
    idProyecto: string
    nombre: string
    /** The owner, i.e. whoever sent the invitation. */
    idUsuario: string
  }
}

/** `AutorMensaje` in the Prisma schema: a person, or the room's AI (CU-02). */
export type AutorMensaje = 'USUARIO' | 'IA'

/** `TipoMensaje`. VOZ arrives with CU-03. */
export type TipoMensaje = 'TEXTO' | 'VOZ'

/** One chat message, as `mensaje.repository` returns it. */
export type Mensaje = {
  idMensaje: string
  idProyecto: string
  autor: AutorMensaje
  tipo: TipoMensaje
  texto: string
  /** ISO timestamp, set by the server. */
  fecha: string
  /** The id the sender's client gave it before sending; null for the AI. */
  idCliente: string | null
  /** AI replies only: the question they answer. */
  respondeA: string | null
  /** Who wrote it. Null for the AI, and for a deleted account. */
  usuario: Pick<Usuario, 'idUsuario' | 'nombre'> | null
  /** AI replies only: whoever asked. */
  mencionA: Pick<Usuario, 'idUsuario' | 'nombre'> | null
  /** Voice notes (CU-03): the audio is fetched by message id, never by URL. */
  tieneAudio: boolean
  /** Measured while recording; null for AI replies (the player reads it from the file). */
  duracionMs: number | null
  /** What a voice note says. Null while it is being transcribed, or if that failed. */
  transcripcion: string | null
}

/** `GET /proyectos/:id/mensajes`: oldest first, and whether there is more further back. */
export type PaginaMensajes = {
  mensajes: Mensaje[]
  hayMas: boolean
}

/* Version history (CU-05) ------------------------------------------------- */

/** `OrigenVersion`: who or what made the version. */
export type OrigenVersion = 'MANUAL' | 'AUTOMATICA' | 'IA' | 'RESTAURACION'

/** One version in the list: no content, which is fetched one at a time. */
export type VersionResumen = {
  idVersion: string
  idProyecto: string
  numero: number
  origen: OrigenVersion
  nombre: string | null
  clases: number
  relaciones: number
  fecha: string
  usuario: { idUsuario: string; nombre: string } | null
}

/** A version with its diagram, the same object as `Proyecto.contenido`. */
export type Version = VersionResumen & { contenido: unknown }

export type PaginaVersiones = {
  versiones: VersionResumen[]
  hayMas: boolean
}
