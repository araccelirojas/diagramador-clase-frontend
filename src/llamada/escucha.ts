import { apiFetch } from '@/api/client'

/**
 * El oído de Jarvis en este navegador: transcribe lo que dice SU persona, frase por frase.
 *
 * Es una sesión de tiempo real de OpenAI configurada en el backend para no responder nunca
 * (`POST /voz/escucha`): de ella solo se usa la transcripción de cada frase, cortada por la
 * detección de voz de OpenAI. Qué hacer con esa frase lo decide `useLlamadaStore`: si
 * empieza por "Jarvis" va a la IA del chat; si no, se descarta acá mismo.
 *
 * Como en `useVozAgent`, el audio va por WebRTC directo a OpenAI con un token efímero que
 * pide el backend; la clave de OpenAI nunca llega al navegador.
 */

const LLAMADAS = 'https://api.openai.com/v1/realtime/calls'
const CANAL = 'oai-events'

/** Esperas antes de cada reconexión si la sesión se cae (OpenAI las cierra al rato). */
const ESPERAS_MS = [1000, 3000, 8000]

export type EstadoEscucha = 'apagada' | 'conectando' | 'activa' | 'error'

export type EventosEscucha = {
  /** Una frase terminada, ya transcrita. */
  alTranscribir: (texto: string, idFrase: string) => void
  /** Empezó a hablar: la frase que viene tendrá este id. */
  alEmpezarFrase: (idFrase: string) => void
  alEstado: (estado: EstadoEscucha, error?: string) => void
}

export class Escucha {
  private pc: RTCPeerConnection | null = null
  private canal: RTCDataChannel | null = null
  private detenida = true
  private fallos = 0
  private reintento: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly pista: MediaStreamTrack,
    private readonly eventos: EventosEscucha,
  ) {}

  iniciar(): void {
    this.detenida = false
    this.fallos = 0
    void this.conectar()
  }

  detener(): void {
    this.detenida = true
    if (this.reintento !== null) clearTimeout(this.reintento)
    this.reintento = null
    this.cerrarConexion()
    this.eventos.alEstado('apagada')
  }

  private cerrarConexion(): void {
    if (this.canal !== null) {
      this.canal.onmessage = null
      this.canal.onclose = null
      this.canal.close()
    }
    if (this.pc !== null) {
      this.pc.onconnectionstatechange = null
      this.pc.close()
    }
    this.canal = null
    this.pc = null
  }

  private async conectar(): Promise<void> {
    this.eventos.alEstado('conectando')

    try {
      const { valor } = await apiFetch<{ valor: string }>('/voz/escucha', { method: 'POST' })
      if (this.detenida) return

      const pc = new RTCPeerConnection()
      this.pc = pc
      // La MISMA pista que oyen los demás, no una copia: silenciarse en la llamada tiene que
      // silenciarse también para Jarvis. Cerrar esta conexión no la detiene.
      pc.addTrack(this.pista)

      const canal = pc.createDataChannel(CANAL)
      this.canal = canal
      canal.onmessage = (evento: MessageEvent<string>) => this.alRecibir(evento.data)
      canal.onclose = () => this.alCaerse('Se cerró la conexión con el transcriptor.')

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') this.alCaerse('Se cortó la conexión con el transcriptor.')
      }

      const oferta = await pc.createOffer()
      await pc.setLocalDescription(oferta)

      const respuesta = await fetch(LLAMADAS, {
        method: 'POST',
        headers: { Authorization: `Bearer ${valor}`, 'Content-Type': 'application/sdp' },
        body: oferta.sdp ?? '',
      })
      const sdp = await respuesta.text()

      if (!respuesta.ok) {
        throw new Error(`OpenAI rechazó la conexión (${respuesta.status})${sdp === '' ? '' : `: ${sdp.slice(0, 160)}`}`)
      }
      if (this.detenida) return

      await pc.setRemoteDescription({ type: 'answer', sdp })
    } catch (causa) {
      this.alCaerse(causa instanceof Error ? causa.message : 'No se pudo conectar el transcriptor.')
    }
  }

  private alCaerse(motivo: string): void {
    if (this.detenida) return

    this.cerrarConexion()
    const espera = ESPERAS_MS[this.fallos]
    this.fallos += 1

    if (espera === undefined) {
      this.eventos.alEstado('error', motivo)
      return
    }

    this.eventos.alEstado('conectando')
    if (this.reintento !== null) clearTimeout(this.reintento)
    this.reintento = setTimeout(() => {
      this.reintento = null
      if (!this.detenida) void this.conectar()
    }, espera)
  }

  private enviar(evento: Record<string, unknown>): void {
    if (this.canal?.readyState === 'open') this.canal.send(JSON.stringify(evento))
  }

  private alRecibir(datos: string): void {
    let mensaje: Record<string, unknown>
    try {
      mensaje = JSON.parse(datos) as Record<string, unknown>
    } catch {
      return
    }

    const tipo = String(mensaje.type ?? '')

    if (tipo === 'session.created') {
      this.fallos = 0
      this.eventos.alEstado('activa')
      return
    }

    if (tipo === 'input_audio_buffer.speech_started') {
      this.eventos.alEmpezarFrase(String(mensaje.item_id ?? ''))
      return
    }

    if (tipo === 'conversation.item.input_audio_transcription.completed') {
      const idFrase = String(mensaje.item_id ?? '')
      const texto = String(mensaje.transcript ?? '').trim()
      if (texto !== '') this.eventos.alTranscribir(texto, idFrase)

      // La sesión guarda cada frase como parte de una conversación que nadie va a usar:
      // se borra para que no crezca durante toda la llamada.
      if (idFrase !== '') this.enviar({ type: 'conversation.item.delete', item_id: idFrase })
      return
    }

    if (tipo === 'error') {
      // Borrar una frase que ya no existe, por ejemplo, no es para mostrar.
      const detalle = mensaje.error as { message?: string } | undefined
      console.warn('Escucha de Jarvis:', detalle?.message ?? mensaje)
    }
  }
}
