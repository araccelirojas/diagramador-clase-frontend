/**
 * El audio de la llamada grupal: una conexión WebRTC con cada una de las otras personas
 * (una malla). El audio va directo de navegador a navegador; el servidor solo pasa las
 * señales con las que se encuentran (`llamada:senal`).
 *
 * Quién llama a quién está fijado para que dos navegadores no se manden ofertas a la vez:
 * el que entra llama a los que ya estaban. Si una conexión se cae del todo, la reintenta
 * el lado con el id de socket menor, y el otro espera su oferta.
 */

export type Senal =
  | { tipo: 'oferta'; sdp: string }
  | { tipo: 'respuesta'; sdp: string }
  | { tipo: 'candidato'; candidato: RTCIceCandidateInit }

export type EventosMalla = {
  enviar: (para: string, senal: Senal) => void
  /** Llegó (o cambió) el audio de alguien: para el indicador de quién habla. */
  alAudio: (id: string, audio: MediaStream) => void
  alQuitar: (id: string) => void
  alEstado: (id: string, conectado: boolean) => void
}

type Par = {
  pc: RTCPeerConnection
  altavoz: HTMLAudioElement
  /** Candidatos que llegaron antes que la descripción del otro lado. */
  pendientes: RTCIceCandidateInit[]
}

const MAX_REINTENTOS = 2

function leerSenal(datos: unknown): Senal | null {
  if (typeof datos !== 'object' || datos === null) return null
  const senal = datos as Record<string, unknown>

  if ((senal.tipo === 'oferta' || senal.tipo === 'respuesta') && typeof senal.sdp === 'string') {
    return { tipo: senal.tipo, sdp: senal.sdp }
  }
  if (senal.tipo === 'candidato' && typeof senal.candidato === 'object' && senal.candidato !== null) {
    return { tipo: 'candidato', candidato: senal.candidato as RTCIceCandidateInit }
  }
  return null
}

export class Malla {
  private readonly pares = new Map<string, Par>()
  private readonly reintentos = new Map<string, number>()
  private cerrada = false

  constructor(
    private readonly local: MediaStream,
    private readonly iceServers: RTCIceServer[],
    private readonly miId: string,
    private readonly eventos: EventosMalla,
  ) {}

  /** Inicia la conexión con alguien que ya estaba en la llamada. */
  async llamar(id: string): Promise<void> {
    const par = this.crear(id)

    try {
      const oferta = await par.pc.createOffer()
      await par.pc.setLocalDescription(oferta)
      this.eventos.enviar(id, { tipo: 'oferta', sdp: oferta.sdp ?? '' })
    } catch (error) {
      console.error('Llamada: no se pudo llamar a', id, error)
    }
  }

  async recibir(de: string, datos: unknown): Promise<void> {
    const senal = leerSenal(datos)
    if (senal === null || this.cerrada) return

    try {
      if (senal.tipo === 'oferta') {
        // Una oferta nueva de alguien con quien ya había conexión es una reconexión:
        // la vieja no sirve más.
        if (this.pares.has(de)) this.quitar(de, false)

        const par = this.crear(de)
        await par.pc.setRemoteDescription({ type: 'offer', sdp: senal.sdp })
        await this.vaciarPendientes(par)

        const respuesta = await par.pc.createAnswer()
        await par.pc.setLocalDescription(respuesta)
        this.eventos.enviar(de, { tipo: 'respuesta', sdp: respuesta.sdp ?? '' })
        return
      }

      const par = this.pares.get(de)
      if (par === undefined) return

      if (senal.tipo === 'respuesta') {
        if (par.pc.signalingState !== 'have-local-offer') return
        await par.pc.setRemoteDescription({ type: 'answer', sdp: senal.sdp })
        await this.vaciarPendientes(par)
        return
      }

      if (par.pc.remoteDescription === null) par.pendientes.push(senal.candidato)
      else await par.pc.addIceCandidate(senal.candidato)
    } catch (error) {
      console.error('Llamada: señal que no se pudo aplicar de', de, error)
    }
  }

  /** Alguien salió de la llamada: se cierra su conexión y se deja de oírlo. */
  quitar(id: string, avisar = true): void {
    const par = this.pares.get(id)
    if (par === undefined) return

    this.pares.delete(id)
    par.pc.onicecandidate = null
    par.pc.ontrack = null
    par.pc.onconnectionstatechange = null
    par.pc.close()
    par.altavoz.pause()
    par.altavoz.srcObject = null

    if (avisar) {
      this.reintentos.delete(id)
      this.eventos.alQuitar(id)
    }
  }

  cerrar(): void {
    this.cerrada = true
    for (const id of [...this.pares.keys()]) this.quitar(id)
  }

  /** Con quiénes hay conexión, conectada o todavía negociándose. */
  ids(): string[] {
    return [...this.pares.keys()]
  }

  private crear(id: string): Par {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers })
    const altavoz = new Audio()
    altavoz.autoplay = true

    const par: Par = { pc, altavoz, pendientes: [] }
    this.pares.set(id, par)

    for (const pista of this.local.getAudioTracks()) pc.addTrack(pista, this.local)

    pc.onicecandidate = (evento) => {
      if (evento.candidate !== null) {
        this.eventos.enviar(id, { tipo: 'candidato', candidato: evento.candidate.toJSON() })
      }
    }

    pc.ontrack = (evento) => {
      const audio = evento.streams[0] ?? new MediaStream([evento.track])
      altavoz.srcObject = audio
      // El clic en "Unirse" ya habilitó el audio de la página; si igual lo bloquea, no
      // hay nada mejor que hacer que seguir sin romper la llamada.
      void altavoz.play().catch(() => {})
      this.eventos.alAudio(id, audio)
    }

    pc.onconnectionstatechange = () => {
      const estado = pc.connectionState
      this.eventos.alEstado(id, estado === 'connected')

      if (estado !== 'failed' || this.cerrada || this.pares.get(id)?.pc !== pc) return

      const hechos = this.reintentos.get(id) ?? 0
      if (this.miId < id && hechos < MAX_REINTENTOS) {
        this.reintentos.set(id, hechos + 1)
        this.quitar(id, false)
        void this.llamar(id)
      }
    }

    return par
  }

  private async vaciarPendientes(par: Par): Promise<void> {
    const pendientes = par.pendientes
    par.pendientes = []
    for (const candidato of pendientes) {
      await par.pc.addIceCandidate(candidato).catch(() => {})
    }
  }
}
