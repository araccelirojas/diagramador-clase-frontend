import { nanoid } from 'nanoid'
import type { Socket } from 'socket.io-client'
import { create } from 'zustand'

import type { Mensaje } from '@/api/types'
import { audioUrl } from '@/chat/audioCache'
import { diagramForAI, useChatStore } from '@/chat/useChatStore'
import { Escucha, type EstadoEscucha } from '@/llamada/escucha'
import { detectarJarvis } from '@/llamada/jarvis'
import { Malla, type Senal } from '@/llamada/malla'
import { Niveles } from '@/llamada/niveles'

/**
 * La llamada de voz grupal de la sala, con Jarvis adentro.
 *
 *   - El audio entre personas va por WebRTC, de navegador a navegador (`Malla`).
 *   - Cada navegador transcribe solo el micrófono de su persona (`Escucha`). Si la frase
 *     empieza por "Jarvis", va al servidor como pregunta para la IA del chat; si no, se
 *     descarta acá: lo que hablan entre ustedes no se guarda ni lo lee nadie.
 *   - La IA contesta como en el chat (puede consultar y cambiar el diagrama; sus cambios se
 *     votan). Su respuesta llega como nota de voz y cada navegador de la llamada la
 *     reproduce, así la escuchan todos.
 *
 * Lo que vive afuera del store (conexiones, micrófono, reproductor) no es estado de React:
 * son recursos con su propio ciclo de vida, y el store solo publica lo que la pantalla
 * necesita mostrar.
 */

export type ParticipanteLlamada = {
  idSocket: string
  idUsuario: string
  nombre: string
  silenciado: boolean
  desde: number
}

/** Lo que Jarvis está haciendo, visto desde esta pantalla. */
export type EstadoJarvis = 'esperando' | 'escuchando' | 'pensando' | 'hablando'

export type Entrada = {
  id: string
  de: 'persona' | 'jarvis' | 'aviso' | 'error'
  nombre?: string
  texto: string
}

type LlamadaState = {
  /** Quién está en la llamada de la sala. Se ve aunque uno no esté adentro. */
  participantes: ParticipanteLlamada[]
  miSocket: string | null
  estado: 'fuera' | 'entrando' | 'dentro'
  silenciado: boolean
  /** idSocket de quienes suenan ahora (incluido uno mismo). */
  hablando: string[]
  /** Con quiénes ya hay audio. */
  conectados: string[]
  escucha: EstadoEscucha
  errorEscucha: string | null
  jarvis: EstadoJarvis
  /** Lo que se habló con Jarvis en esta llamada. */
  registro: Entrada[]
  error: string | null
  /** Cuándo entró uno, para el reloj. */
  desde: number | null
}

const INICIAL: LlamadaState = {
  participantes: [],
  miSocket: null,
  estado: 'fuera',
  silenciado: false,
  hablando: [],
  conectados: [],
  escucha: 'apagada',
  errorEscucha: null,
  jarvis: 'esperando',
  registro: [],
  error: null,
  desde: null,
}

export const useLlamadaStore = create<LlamadaState>()(() => ({ ...INICIAL }))

const set = useLlamadaStore.setState
const get = useLlamadaStore.getState

/** Después de "Jarvis" a secas, cuánto se espera la pregunta. */
const ESPERA_PREGUNTA_MS = 8000
/** Tras la voz de Jarvis, lo que se oye un instante más puede ser su propio eco. */
const SILENCIO_TRAS_JARVIS_MS = 1200
const MAX_REGISTRO = 30
const ACK_MS = 15000

/* ------------------------------------------------------------------------ */
/* Recursos de la llamada en curso                                           */
/* ------------------------------------------------------------------------ */

let socket: Socket | null = null
let microfono: MediaStream | null = null
let malla: Malla | null = null
let niveles: Niveles | null = null
let escucha: Escucha | null = null

/** Si la conexión con la sala se cortó estando en la llamada: al volver, se vuelve a entrar. */
let volverAlReconectar = false

/** Mensajes que alguien le dijo a Jarvis en la llamada: su respuesta suena en ella. */
const preguntas = new Set<string>()
/** Frases que empezaron mientras hablaba Jarvis: pueden ser su eco. */
const ignoradas = new Set<string>()
let esperandoPreguntaHasta = 0
let esperaTimer: ReturnType<typeof setTimeout> | null = null
let silencioHasta = 0

let reproduciendo: HTMLAudioElement | null = null
const colaDeRespuestas: string[] = []

function anotar(entrada: Omit<Entrada, 'id'>): void {
  set((state) => ({ registro: [...state.registro, { ...entrada, id: nanoid(8) }].slice(-MAX_REGISTRO) }))
}

/** El micrófono hacia los demás y hacia Jarvis: apagado si uno se silenció o si Jarvis habla. */
function aplicarMicrofono(): void {
  const abierto = !get().silenciado && reproduciendo === null
  for (const pista of microfono?.getAudioTracks() ?? []) pista.enabled = abierto
}

/* ------------------------------------------------------------------------ */
/* Lo que se le dice a Jarvis                                                */
/* ------------------------------------------------------------------------ */

type AckJarvis =
  | { ok: true; mensaje?: Mensaje; voto?: 'conservar' | 'descartar'; repetida?: boolean }
  | { ok: false; message?: string }

async function preguntarAJarvis(texto: string): Promise<void> {
  if (socket === null || !socket.connected) {
    anotar({ de: 'error', texto: 'Sin conexión con la sala: Jarvis no te pudo oír.' })
    return
  }

  set({ jarvis: 'pensando' })

  let ack: AckJarvis
  try {
    ack = (await socket.timeout(ACK_MS).emitWithAck('llamada:jarvis', {
      texto,
      idCliente: `j_${nanoid(12)}`,
      // Como en el chat: el diagrama tal como lo ve quien pregunta, ahora.
      diagrama: diagramForAI(),
    })) as AckJarvis
  } catch {
    ack = { ok: false, message: 'El servidor no confirmó la pregunta.' }
  }

  if (!ack.ok) {
    anotar({ de: 'error', texto: ack.message ?? 'Jarvis no pudo recibir la pregunta.' })
    set({ jarvis: 'esperando' })
    return
  }

  if (ack.voto !== undefined) {
    anotar({
      de: 'aviso',
      texto: `Tu voto: ${ack.voto === 'conservar' ? 'conservar' : 'descartar'} el cambio.`,
    })
    set({ jarvis: 'esperando' })
  }
}

function alTranscribir(texto: string, idFrase: string): void {
  if (ignoradas.delete(idFrase)) return
  if (reproduciendo !== null || Date.now() < silencioHasta) return

  const deteccion = detectarJarvis(texto)

  if (deteccion === null) {
    // "Jarvis." y la pregunta en la frase siguiente.
    if (Date.now() < esperandoPreguntaHasta) {
      esperandoPreguntaHasta = 0
      void preguntarAJarvis(`Jarvis, ${texto}`)
    }
    // Todo lo demás es conversación entre ustedes: no sale de acá.
    return
  }

  if (deteccion.resto === '') {
    esperandoPreguntaHasta = Date.now() + ESPERA_PREGUNTA_MS
    set({ jarvis: 'escuchando' })
    niveles?.aviso()

    if (esperaTimer !== null) clearTimeout(esperaTimer)
    esperaTimer = setTimeout(() => {
      esperaTimer = null
      if (get().jarvis === 'escuchando' && Date.now() >= esperandoPreguntaHasta) set({ jarvis: 'esperando' })
    }, ESPERA_PREGUNTA_MS + 100)
    return
  }

  esperandoPreguntaHasta = 0
  void preguntarAJarvis(texto)
}

function alEmpezarFrase(idFrase: string): void {
  if (reproduciendo !== null && idFrase !== '') ignoradas.add(idFrase)
}

/* ------------------------------------------------------------------------ */
/* La voz de Jarvis                                                          */
/* ------------------------------------------------------------------------ */

async function reproducirSiguiente(): Promise<void> {
  const idMensaje = colaDeRespuestas.shift()
  const { idProyecto } = useChatStore.getState()

  if (idMensaje === undefined || idProyecto === null || get().estado !== 'dentro') {
    if (get().jarvis === 'hablando') set({ jarvis: 'esperando' })
    return
  }

  const terminar = (audio: HTMLAudioElement) => {
    if (reproduciendo !== audio) return
    reproduciendo = null
    silencioHasta = Date.now() + SILENCIO_TRAS_JARVIS_MS
    aplicarMicrofono()
    void reproducirSiguiente()
  }

  try {
    const url = await audioUrl(idProyecto, idMensaje)
    if (get().estado !== 'dentro') return

    const audio = new Audio(url)
    reproduciendo = audio
    // Mientras habla, el micrófono de cada uno se cierra: su voz sale por los parlantes y,
    // sin auriculares, se colaría de vuelta a la llamada (y a la escucha de Jarvis).
    aplicarMicrofono()
    set({ jarvis: 'hablando' })

    audio.onended = () => terminar(audio)
    audio.onerror = () => terminar(audio)
    await audio.play()
  } catch {
    if (reproduciendo !== null) {
      reproduciendo = null
      aplicarMicrofono()
    }
    anotar({ de: 'error', texto: 'No se pudo reproducir la respuesta de Jarvis; está en el chat.' })
    void reproducirSiguiente()
  }
}

/** Corta la respuesta que está sonando (solo en esta pantalla). */
export function callarJarvis(): void {
  colaDeRespuestas.length = 0
  if (reproduciendo !== null) {
    const audio = reproduciendo
    reproduciendo = null
    audio.pause()
    silencioHasta = Date.now() + SILENCIO_TRAS_JARVIS_MS
    aplicarMicrofono()
  }
  set({ jarvis: 'esperando' })
}

/** Para el chat: esta respuesta de la IA suena en la llamada, no en su burbuja. */
export function esRespuestaDeLlamada(mensaje: Mensaje): boolean {
  return mensaje.autor === 'IA' && mensaje.respondeA !== null && preguntas.has(mensaje.respondeA)
}

/* ------------------------------------------------------------------------ */
/* Entrar y salir                                                            */
/* ------------------------------------------------------------------------ */

type AckEntrar =
  | { ok: true; otros: string[]; iceServers: RTCIceServer[] }
  | { ok: false; message?: string }

function liberar(): void {
  malla?.cerrar()
  escucha?.detener()
  niveles?.cerrar()
  for (const pista of microfono?.getTracks() ?? []) pista.stop()
  if (reproduciendo !== null) reproduciendo.pause()
  if (esperaTimer !== null) clearTimeout(esperaTimer)

  malla = null
  escucha = null
  niveles = null
  microfono = null
  reproduciendo = null
  esperaTimer = null
  colaDeRespuestas.length = 0
  ignoradas.clear()
  esperandoPreguntaHasta = 0
}

export async function unirseALaLlamada(): Promise<void> {
  if (get().estado !== 'fuera') return

  if (socket === null || !socket.connected || socket.id === undefined) {
    set({ error: 'Sin conexión con la sala.' })
    return
  }
  const conexion = socket
  const miId = socket.id

  set({ estado: 'entrando', error: null })

  try {
    microfono = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
  } catch {
    set({
      estado: 'fuera',
      error: 'No se pudo usar el micrófono. Revisá el permiso del navegador para este sitio.',
    })
    return
  }

  // Colgó (o se fue del proyecto) mientras el navegador pedía el permiso.
  if (get().estado !== 'entrando') {
    liberar()
    return
  }

  let ack: AckEntrar
  try {
    ack = (await conexion.timeout(ACK_MS).emitWithAck('llamada:entrar', {})) as AckEntrar
  } catch {
    ack = { ok: false, message: 'El servidor no respondió.' }
  }

  if (get().estado !== 'entrando') {
    if (ack.ok && conexion.connected) conexion.emit('llamada:salir')
    liberar()
    return
  }

  if (!ack.ok || socket !== conexion) {
    liberar()
    set({ estado: 'fuera', error: ack.ok ? null : (ack.message ?? 'No se pudo entrar a la llamada.') })
    return
  }

  const local = microfono
  const medidor = new Niveles((hablando) => set({ hablando }))
  niveles = medidor
  medidor.observar(miId, local)

  malla = new Malla(local, ack.iceServers, miId, {
    enviar: (para: string, senal: Senal) => conexion.emit('llamada:senal', { para, datos: senal }),
    alAudio: (id, audio) => medidor.observar(id, audio),
    alQuitar: (id) => {
      medidor.dejar(id)
      set((state) => ({ conectados: state.conectados.filter((c) => c !== id) }))
    },
    alEstado: (id, conectado) =>
      set((state) => ({
        conectados: conectado
          ? [...new Set([...state.conectados, id])]
          : state.conectados.filter((c) => c !== id),
      })),
  })

  // Quien entra llama a los que ya estaban.
  for (const otro of ack.otros) void malla.llamar(otro)

  const pista = local.getAudioTracks()[0]
  if (pista !== undefined) {
    escucha = new Escucha(pista, {
      alTranscribir,
      alEmpezarFrase,
      alEstado: (estado, error) => set({ escucha: estado, errorEscucha: error ?? null }),
    })
    escucha.iniciar()
  }

  set({
    estado: 'dentro',
    miSocket: miId,
    silenciado: false,
    desde: Date.now(),
    jarvis: 'esperando',
    error: null,
  })
}

export function colgar(): void {
  volverAlReconectar = false
  if (get().estado === 'fuera') return

  // Entrando, el servidor quizás todavía no la tiene adentro; `unirseALaLlamada` lo resuelve.
  if (get().estado === 'dentro' && socket?.connected === true) socket.emit('llamada:salir')
  liberar()
  set({
    estado: 'fuera',
    hablando: [],
    conectados: [],
    escucha: 'apagada',
    errorEscucha: null,
    jarvis: 'esperando',
    desde: null,
    silenciado: false,
  })
}

export function alternarSilencio(): void {
  if (get().estado !== 'dentro') return

  const silenciado = !get().silenciado
  set({ silenciado })
  aplicarMicrofono()
  socket?.emit('llamada:silencio', { silenciado })
}

/** El transcriptor se rindió tras varios intentos: otra vez, a pedido. */
export function reintentarEscucha(): void {
  escucha?.iniciar()
}

/* ------------------------------------------------------------------------ */
/* La sala                                                                   */
/* ------------------------------------------------------------------------ */

/** Registra lo que la sala dice de la llamada. Una vez por socket. */
export function escucharLlamada(conexion: Socket): void {
  conexion.on('llamada:estado', ({ participantes }: { participantes: ParticipanteLlamada[] }) => {
    set({ participantes: Array.isArray(participantes) ? participantes : [] })

    // Quien ya no está, se deja de oír (por si su conexión no avisó al cerrarse).
    if (malla !== null && Array.isArray(participantes)) {
      const presentes = new Set(participantes.map((p) => p.idSocket))
      for (const id of malla.ids()) if (!presentes.has(id)) malla.quitar(id)
    }
  })

  conexion.on('llamada:senal', ({ de, datos }: { de: string; datos: unknown }) => {
    if (malla !== null && typeof de === 'string') void malla.recibir(de, datos)
  })

  conexion.on('llamada:pregunta', ({ idMensaje, nombre, texto }: { idMensaje: string; nombre: string; texto: string }) => {
    preguntas.add(idMensaje)
    if (get().estado === 'dentro') {
      anotar({ de: 'persona', nombre, texto })
      set({ jarvis: 'pensando' })
    }
  })

  conexion.on('ia-escribiendo', ({ activo, respondeA }: { activo: boolean; respondeA: string }) => {
    if (!preguntas.has(respondeA) || get().estado !== 'dentro') return
    if (activo) set({ jarvis: 'pensando' })
    else if (get().jarvis === 'pensando' && reproduciendo === null) set({ jarvis: 'esperando' })
  })

  conexion.on('ia-error', ({ respondeA, message }: { respondeA: string; message: string }) => {
    if (!preguntas.has(respondeA) || get().estado !== 'dentro') return
    anotar({ de: 'error', texto: `Jarvis no pudo responder: ${message}` })
    if (reproduciendo === null) set({ jarvis: 'esperando' })
  })

  conexion.on('mensaje', (mensaje: Mensaje) => {
    if (!esRespuestaDeLlamada(mensaje) || get().estado !== 'dentro') return

    anotar({ de: 'jarvis', texto: mensaje.transcripcion ?? mensaje.texto })
    if (mensaje.tieneAudio) {
      colaDeRespuestas.push(mensaje.idMensaje)
      if (reproduciendo === null) void reproducirSiguiente()
    } else if (reproduciendo === null) {
      set({ jarvis: 'esperando' })
    }
  })
}

/** En la sala (otra vez). Si la conexión se había cortado en plena llamada, se vuelve a entrar. */
export function salaUnida(conexion: Socket, participantes: ParticipanteLlamada[]): void {
  socket = conexion
  set({ participantes, miSocket: conexion.id ?? null })

  if (volverAlReconectar) {
    volverAlReconectar = false
    void unirseALaLlamada()
  }
}

/** Se cortó la conexión con la sala: la llamada no puede seguir, pero vuelve sola. */
export function salaCaida(): void {
  if (get().estado === 'fuera') return

  liberar()
  volverAlReconectar = true
  set({
    estado: 'fuera',
    hablando: [],
    conectados: [],
    escucha: 'apagada',
    jarvis: 'esperando',
    desde: null,
    error: 'Se cortó la conexión con la sala. Volviendo a la llamada…',
  })
}

/** Salir del proyecto: nada de esta llamada sigue en el siguiente. */
export function salaCerrada(): void {
  colgar()
  socket = null
  volverAlReconectar = false
  preguntas.clear()
  set({ ...INICIAL })
}
