import { useCallback, useEffect, useRef, useState } from 'react'

import { apiFetch } from '@/api/client'
import { onStoreChange, useDiagramStore } from '@/state/useDiagramStore'
import { ejecutarHerramienta, HERRAMIENTAS } from '@/voz/herramientas'
import { resumirDiagrama } from '@/voz/resumen'

/**
 * La llamada con el agente de voz.
 *
 * El audio va por WebRTC DIRECTAMENTE del navegador a OpenAI: eso es lo que hace que se
 * sienta como una llamada y no como esperar a que cargue una respuesta. Por aquí solo pasan
 * los eventos de texto, por un canal de datos, que es donde el modelo pide ejecutar una
 * herramienta y nosotros le contestamos qué pasó.
 *
 * La credencial es un token efímero que pide el backend. La clave de OpenAI no aparece en
 * ningún punto de este archivo, y no puede: es código que se descarga el navegador.
 */

const LLAMADAS = 'https://api.openai.com/v1/realtime/calls'

/** El canal por el que viajan los eventos. El nombre lo fija OpenAI. */
const CANAL = 'oai-events'

const SALTO = '\n'

/** Las herramientas que solo miran. Su resultado es el diagrama entero, no un cambio. */
const SOLO_LEEN: Record<string, string> = {
  resumen_diagrama: 'Miró el diagrama',
  detalle_clase: 'Consultó una clase',
}

/**
 * Lo que se enseña de cada acción en el registro.
 *
 * El resultado que recibe el modelo no sirve aquí: el de una lectura es el diagrama completo
 * en texto, y volcarlo dejaba el panel ilegible. Lo que el usuario necesita saber es qué
 * cambió, en una línea.
 */
function resumirAccion(
  herramienta: string,
  resultado: { ok: true; mensaje: string } | { ok: false; error: string },
): string {
  if (!resultado.ok) return resultado.error

  return SOLO_LEEN[herramienta] ?? resultado.mensaje
}

export type Estado =
  | 'inactivo'
  | 'conectando'
  | 'escuchando'
  | 'hablando'
  | 'ejecutando'
  | 'error'

export type Turno = {
  id: string
  de: 'usuario' | 'agente' | 'accion'
  texto: string
  /** Solo en las acciones: si la herramienta falló. */
  fallo?: boolean
}

type Sesion = { valor: string; expiraEn: number; modelo: string; instrucciones: string }

export function useVozAgent() {
  const [estado, setEstado] = useState<Estado>('inactivo')
  const [error, setError] = useState<string | null>(null)
  const [silenciado, setSilenciado] = useState(false)
  const [turnos, setTurnos] = useState<Turno[]>([])

  const conexion = useRef<RTCPeerConnection | null>(null)
  const canal = useRef<RTCDataChannel | null>(null)
  const micro = useRef<MediaStream | null>(null)
  const altavoz = useRef<HTMLAudioElement | null>(null)
  /** Lo último que se le contó al agente, para no repetírselo idéntico en cada cambio. */
  const ultimoResumen = useRef<string>('')
  /** El prompt que viene del backend. Hay que reenviarlo con cada actualización. */
  const instrucciones = useRef<string>('')
  /**
   * Si el modelo está en medio de una respuesta, y si hay resultados esperando.
   *
   * El modelo puede pedir varias herramientas dentro de UNA sola respuesta —"ordená el
   * diagrama" salieron siete movimientos— y pedirle una respuesta nueva por cada resultado
   * la rechaza con "already has an active response in progress" y deja el trabajo a medias.
   * Se entregan todos los resultados y se pide UNA respuesta cuando la suya termina.
   */
  const respuestaActiva = useRef(false)
  const esperanResultados = useRef(false)

  const anotar = useCallback((turno: Omit<Turno, 'id'>) => {
    setTurnos((previos) => [...previos, { ...turno, id: crypto.randomUUID() }])
  }, [])

  const enviar = useCallback((evento: Record<string, unknown>) => {
    const abierto = canal.current
    if (abierto?.readyState === 'open') abierto.send(JSON.stringify(evento))
  }, [])

  /**
   * Le cuenta al agente cómo está el diagrama ahora mismo.
   *
   * Se llama al empezar y después de CADA cambio, venga del agente o del ratón: si movés o
   * creás una clase a mitad de la llamada, el agente tiene que enterarse o hablará de un
   * diagrama que ya no existe.
   */
  const refrescarContexto = useCallback(() => {
    const resumen = resumirDiagrama(useDiagramStore.getState().doc)
    if (resumen === ultimoResumen.current) return

    ultimoResumen.current = resumen

    /**
     * `instructions` REEMPLAZA lo que hubiera, no se suma.
     *
     * Mandar aquí solo el resumen le borraba el prompt entero al agente: se quedaba sin
     * idioma, sin tono y sin la regla de confirmar antes de borrar, y contestaba como un
     * asistente genérico. Por eso se reenvía el prompt del backend delante del resumen.
     */
    enviar({
      type: 'session.update',
      session: {
        type: 'realtime',
        tools: HERRAMIENTAS,
        tool_choice: 'auto',
        instructions: [
          instrucciones.current,
          '',
          '## El diagrama ahora mismo',
          '',
          'Esto se actualiza solo después de cada cambio, tuyo o del usuario.',
          '',
          resumen,
        ].join(SALTO),
      },
    })
  }, [enviar])

  const colgar = useCallback(() => {
    canal.current?.close()
    conexion.current?.close()
    micro.current?.getTracks().forEach((pista) => pista.stop())

    canal.current = null
    conexion.current = null
    micro.current = null
    ultimoResumen.current = ''

    setEstado('inactivo')
    setSilenciado(false)
  }, [])

  /** Un evento del modelo. Lo que importa aquí son las peticiones de herramienta. */
  const alRecibir = useCallback(
    (evento: MessageEvent<string>) => {
      let mensaje: Record<string, unknown>

      try {
        mensaje = JSON.parse(evento.data) as Record<string, unknown>
      } catch {
        return
      }

      const tipo = String(mensaje.type ?? '')

      if (tipo === 'error') {
        const detalle = mensaje.error as { message?: string } | undefined
        const texto = detalle?.message ?? 'La sesión de voz devolvió un error.'

        setError(texto)
        // También al registro: un `session.update` rechazado deja al agente sin herramientas
        // y sin nada más que lo delate. Se queda conversando como si no pasara nada.
        anotar({ de: 'accion', texto, fallo: true })
        return
      }

      /**
       * La sesión ya existe del otro lado. RECIÉN AHORA se le pueden mandar las herramientas:
       * hacerlo al abrirse el canal de datos llegaba demasiado pronto, el `session.update` se
       * perdía, y el agente se quedaba sin nada que llamar.
       */
      if (tipo === 'session.created') {
        refrescarContexto()
        setEstado('escuchando')
        return
      }

      // La confirmación de que las herramientas quedaron puestas.
      if (tipo === 'session.updated') {
        const sesion = mensaje.session as { tools?: unknown[] } | undefined

        if ((sesion?.tools?.length ?? 0) === 0) {
          anotar({
            de: 'accion',
            texto: 'El agente quedó sin herramientas: no va a poder editar el diagrama.',
            fallo: true,
          })
        }
        return
      }

      // El modelo empieza y termina de hablar. Sirve para el indicador y para saber que se
      // le puede interrumpir.
      if (tipo === 'response.created') {
        respuestaActiva.current = true
        setEstado('hablando')
        return
      }
      if (tipo === 'output_audio_buffer.started') {
        setEstado('hablando')
        return
      }

      if (tipo === 'response.done') {
        respuestaActiva.current = false

        // Su turno terminó y hay resultados sin contestar: ahora sí se le pide que hable.
        if (esperanResultados.current) {
          esperanResultados.current = false
          enviar({ type: 'response.create' })
          return
        }

        setEstado('escuchando')
        return
      }

      if (tipo === 'output_audio_buffer.stopped') {
        setEstado((previo) => (previo === 'ejecutando' ? previo : 'escuchando'))
        return
      }

      // Lo que dijo el usuario, ya transcrito.
      if (tipo === 'conversation.item.input_audio_transcription.completed') {
        const texto = String(mensaje.transcript ?? '').trim()
        if (texto !== '') anotar({ de: 'usuario', texto })
        return
      }

      // Lo que dijo el agente.
      if (tipo === 'response.output_audio_transcript.done' || tipo === 'response.audio_transcript.done') {
        const texto = String(mensaje.transcript ?? '').trim()
        if (texto !== '') anotar({ de: 'agente', texto })
        return
      }

      /**
       * La petición de herramienta.
       *
       * Se ejecuta EN NUESTRO CÓDIGO y se le devuelve el resultado. El `response.create` de
       * después no es opcional: sin él el modelo se queda con el resultado en la mano y sin
       * decir nada, que en una llamada se vive como que se colgó.
       */
      if (tipo === 'response.function_call_arguments.done') {
        const nombre = String(mensaje.name ?? '')
        const callId = String(mensaje.call_id ?? '')

        setEstado('ejecutando')

        let argumentos: unknown = {}
        try {
          argumentos = JSON.parse(String(mensaje.arguments ?? '{}'))
        } catch {
          argumentos = {}
        }

        const resultado = ejecutarHerramienta(nombre, argumentos)

        anotar({ de: 'accion', texto: resumirAccion(nombre, resultado), fallo: !resultado.ok })

        enviar({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify(resultado),
          },
        })

        /**
         * NO se pide respuesta aquí. El modelo puede estar pidiendo varias herramientas
         * seguidas dentro de la misma respuesta, y una petición por resultado se rechaza y
         * corta el trabajo a la mitad. Se anota que hay algo que contestar y se espera a que
         * su turno termine.
         */
        if (respuestaActiva.current) esperanResultados.current = true
        else enviar({ type: 'response.create' })

        // El diagrama acaba de cambiar: que el agente lo sepa antes de hablar.
        refrescarContexto()
      }
    },
    [anotar, enviar, refrescarContexto],
  )

  const llamar = useCallback(async () => {
    if (estado !== 'inactivo' && estado !== 'error') return

    setError(null)
    setEstado('conectando')

    try {
      const sesion = await apiFetch<Sesion>('/voz/sesion', { method: 'POST' })
      instrucciones.current = sesion.instrucciones ?? ''

      let entrada: MediaStream
      try {
        entrada = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        throw new Error(
          'No se pudo usar el micrófono. Revisá el permiso del navegador para este sitio.',
        )
      }
      micro.current = entrada

      const pc = new RTCPeerConnection()
      conexion.current = pc

      // La voz del agente. Se reproduce sola en cuanto llega la pista.
      pc.ontrack = (evento) => {
        if (altavoz.current === null) {
          altavoz.current = new Audio()
          altavoz.current.autoplay = true
        }
        altavoz.current.srcObject = evento.streams[0] ?? null
      }

      for (const pista of entrada.getTracks()) pc.addTrack(pista, entrada)

      // El canal y sus oyentes ANTES de la oferta: si se crea después, no entra en el SDP.
      const dc = pc.createDataChannel(CANAL)
      canal.current = dc
      dc.addEventListener('message', alRecibir)
      // Al abrirse el canal solo se espera: quien dispara el envío es `session.created`.
      dc.addEventListener('open', () => setEstado('escuchando'))

      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setError('Se cortó la conexión con el agente.')
          setEstado('error')
        }
      })

      const oferta = await pc.createOffer()
      await pc.setLocalDescription(oferta)

      const respuesta = await fetch(LLAMADAS, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sesion.valor}`,
          'Content-Type': 'application/sdp',
        },
        body: oferta.sdp ?? '',
      })

      const sdp = await respuesta.text()

      if (!respuesta.ok) {
        // El cuerpo trae el motivo real; sin él, diagnosticar esto es adivinar.
        throw new Error(
          `OpenAI rechazó la conexión (${respuesta.status})${sdp === '' ? '.' : `: ${sdp.slice(0, 200)}`}`,
        )
      }

      await pc.setRemoteDescription({ type: 'answer', sdp })
    } catch (causa) {
      colgar()
      setError(causa instanceof Error ? causa.message : 'No se pudo iniciar la llamada.')
      setEstado('error')
    }
  }, [alRecibir, colgar, estado, refrescarContexto])

  const silenciar = useCallback(() => {
    const entrada = micro.current
    if (entrada === null) return

    const siguiente = !silenciado
    for (const pista of entrada.getAudioTracks()) pista.enabled = !siguiente
    setSilenciado(siguiente)
  }, [silenciado])

  /**
   * Cualquier cambio del documento refresca el contexto, incluidos los que hacés con el
   * ratón mientras hablás y los que llegan de otro colaborador.
   */
  useEffect(() => {
    if (estado === 'inactivo' || estado === 'error') return

    return onStoreChange(() => refrescarContexto())
  }, [estado, refrescarContexto])

  // Colgar al desmontar: una llamada abierta sigue cobrando aunque ya no se vea.
  useEffect(() => colgar, [colgar])

  return { estado, error, silenciado, turnos, llamar, colgar, silenciar }
}
