/**
 * Quién está hablando en la llamada, para iluminar su nombre.
 *
 * Mide el volumen de cada audio (el propio y el de cada persona) unas cinco veces por
 * segundo. Con un umbral y un pequeño margen al soltar, para que el indicador no parpadee
 * entre palabra y palabra.
 */

const UMBRAL = 0.03
const MANTENER_MS = 400
const CADA_MS = 180

type Medidor = { fuente: MediaStreamAudioSourceNode; analizador: AnalyserNode; ultimaVoz: number }

export class Niveles {
  private readonly contexto: AudioContext
  private readonly medidores = new Map<string, Medidor>()
  private readonly reloj: ReturnType<typeof setInterval>
  private ultimo = ''
  private readonly muestras = new Uint8Array(512)

  constructor(private readonly alCambiar: (hablando: string[]) => void) {
    this.contexto = new AudioContext()
    this.reloj = setInterval(() => this.medir(), CADA_MS)
  }

  /** El contexto de audio, también para el aviso sonoro de Jarvis. */
  get audio(): AudioContext {
    return this.contexto
  }

  observar(id: string, audio: MediaStream): void {
    this.dejar(id)
    if (audio.getAudioTracks().length === 0) return

    const fuente = this.contexto.createMediaStreamSource(audio)
    const analizador = this.contexto.createAnalyser()
    analizador.fftSize = 512
    fuente.connect(analizador)
    this.medidores.set(id, { fuente, analizador, ultimaVoz: 0 })
  }

  dejar(id: string): void {
    const medidor = this.medidores.get(id)
    if (medidor === undefined) return
    medidor.fuente.disconnect()
    this.medidores.delete(id)
  }

  cerrar(): void {
    clearInterval(this.reloj)
    for (const id of [...this.medidores.keys()]) this.dejar(id)
    void this.contexto.close().catch(() => {})
  }

  private medir(): void {
    const ahora = Date.now()
    const hablando: string[] = []

    for (const [id, medidor] of this.medidores) {
      medidor.analizador.getByteTimeDomainData(this.muestras)

      let suma = 0
      for (const muestra of this.muestras) {
        const valor = (muestra - 128) / 128
        suma += valor * valor
      }
      if (Math.sqrt(suma / this.muestras.length) > UMBRAL) medidor.ultimaVoz = ahora
      if (ahora - medidor.ultimaVoz < MANTENER_MS) hablando.push(id)
    }

    const clave = hablando.sort().join('|')
    if (clave !== this.ultimo) {
      this.ultimo = clave
      this.alCambiar(hablando)
    }
  }

  /** Un "ding" corto: Jarvis oyó su nombre y espera la pregunta. */
  aviso(): void {
    const ahora = this.contexto.currentTime
    const oscilador = this.contexto.createOscillator()
    const volumen = this.contexto.createGain()
    oscilador.frequency.setValueAtTime(880, ahora)
    oscilador.frequency.setValueAtTime(1320, ahora + 0.09)
    volumen.gain.setValueAtTime(0.0001, ahora)
    volumen.gain.exponentialRampToValueAtTime(0.15, ahora + 0.02)
    volumen.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.25)
    oscilador.connect(volumen).connect(this.contexto.destination)
    oscilador.start(ahora)
    oscilador.stop(ahora + 0.26)
  }
}
