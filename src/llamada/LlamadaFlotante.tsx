import {
  Bot,
  ChevronDown,
  ChevronUp,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  RotateCw,
  Square,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useAuthStore } from '@/auth/useAuthStore'
import { castVote, myVote, useVoteStore } from '@/ia/useVoteStore'
import {
  alternarSilencio,
  callarJarvis,
  colgar,
  reintentarEscucha,
  useLlamadaStore,
  type Entrada,
  type EstadoJarvis,
} from '@/llamada/useLlamadaStore'

/**
 * La llamada en curso, flotando sobre el lienzo: se sigue viendo con cualquier pestaña
 * del panel derecho abierta, y se puede achicar para no tapar el diagrama.
 */

const JARVIS: Record<EstadoJarvis, string> = {
  esperando: 'Decí "Jarvis, …" para preguntarle o pedirle un cambio',
  escuchando: 'Jarvis te escucha…',
  pensando: 'Jarvis está pensando…',
  hablando: 'Jarvis está respondiendo',
}

function reloj(desde: number | null, ahora: number): string {
  if (desde === null) return '0:00'
  const segundos = Math.max(0, Math.floor((ahora - desde) / 1000))
  const minutos = Math.floor(segundos / 60)
  return `${minutos}:${String(segundos % 60).padStart(2, '0')}`
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '?') + (partes[1]?.[0] ?? '')).toUpperCase()
}

function Linea({ entrada }: { entrada: Entrada }) {
  if (entrada.de === 'jarvis') {
    return (
      <li className="flex gap-1.5 text-[11px] leading-snug text-slate-700">
        <Bot className="mt-0.5 h-3 w-3 shrink-0 text-violet-600" />
        <span>{entrada.texto}</span>
      </li>
    )
  }
  if (entrada.de === 'persona') {
    return (
      <li className="text-[11px] leading-snug text-slate-500">
        <span className="font-medium text-slate-700">{entrada.nombre}:</span> {entrada.texto}
      </li>
    )
  }
  return (
    <li
      className={`flex gap-1.5 text-[11px] leading-snug ${
        entrada.de === 'error' ? 'text-red-600' : 'text-emerald-700'
      }`}
    >
      {entrada.de === 'error' && <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />}
      <span>{entrada.texto}</span>
    </li>
  )
}

/** El cambio de Jarvis que la sala está votando, para votar sin ir al chat. */
function Votacion() {
  const vote = useVoteStore((state) => state.vote)
  const idUsuario = useAuthStore((state) => state.usuario?.idUsuario ?? null)

  if (vote === null || vote.estado !== 'abierta') return null

  const mio = myVote(vote, idUsuario)
  const boton = 'flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors'

  return (
    <div className="rounded-md border border-violet-200 bg-violet-50 p-2">
      <p className="text-[11px] leading-snug text-violet-900">
        La sala vota {vote.cambios.length === 1 ? 'un cambio' : `${vote.cambios.length} cambios`} de
        Jarvis. Votá acá o decí "Jarvis, conservalo" / "Jarvis, descartalo".
      </p>
      <div className="mt-1.5 flex gap-1.5">
        <button
          type="button"
          onClick={() => void castVote('conservar')}
          className={`${boton} ${
            mio === 'conservar' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 hover:bg-emerald-50'
          }`}
        >
          Conservar
        </button>
        <button
          type="button"
          onClick={() => void castVote('descartar')}
          className={`${boton} ${
            mio === 'descartar' ? 'bg-red-600 text-white' : 'bg-white text-red-700 hover:bg-red-50'
          }`}
        >
          Descartar
        </button>
      </div>
    </div>
  )
}

export function LlamadaFlotante() {
  const estado = useLlamadaStore((state) => state.estado)
  const participantes = useLlamadaStore((state) => state.participantes)
  const miSocket = useLlamadaStore((state) => state.miSocket)
  const silenciado = useLlamadaStore((state) => state.silenciado)
  const hablando = useLlamadaStore((state) => state.hablando)
  const conectados = useLlamadaStore((state) => state.conectados)
  const escucha = useLlamadaStore((state) => state.escucha)
  const errorEscucha = useLlamadaStore((state) => state.errorEscucha)
  const jarvis = useLlamadaStore((state) => state.jarvis)
  const registro = useLlamadaStore((state) => state.registro)
  const error = useLlamadaStore((state) => state.error)
  const desde = useLlamadaStore((state) => state.desde)

  const [compacta, setCompacta] = useState(false)
  const [ahora, setAhora] = useState(() => Date.now())
  const finDeRegistro = useRef<HTMLLIElement>(null)

  const dentro = estado === 'dentro'

  useEffect(() => {
    if (!dentro) return
    const reloj = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(reloj)
  }, [dentro])

  useEffect(() => {
    finDeRegistro.current?.scrollIntoView({ block: 'end' })
  }, [registro])

  // Fuera de la llamada solo se muestra un error (por ejemplo, sin permiso de micrófono).
  if (!dentro) {
    if (error === null || estado === 'entrando') return null
    return (
      <div className="absolute bottom-3 left-14 z-20 flex w-72 items-start gap-2 rounded-lg border border-red-200 bg-white p-2.5 text-[11px] leading-snug text-red-700 shadow-lg">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">{error}</span>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={() => useLlamadaStore.setState({ error: null })}
          className="rounded-sm p-0.5 text-red-400 hover:bg-red-50 hover:text-red-700"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="absolute bottom-3 left-14 z-20 flex w-80 flex-col gap-2 rounded-lg border border-slate-200 bg-white/95 p-2.5 shadow-lg backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
        <span className="text-xs font-semibold text-slate-800">Llamada del grupo</span>
        <span className="text-[11px] text-slate-400 tabular-nums">{reloj(desde, ahora)}</span>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={alternarSilencio}
            title={silenciado ? 'Activar el micrófono' : 'Silenciar el micrófono'}
            className={`rounded-md p-1.5 transition-colors ${
              silenciado ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {silenciado ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={colgar}
            title="Salir de la llamada"
            className="rounded-md bg-red-600 p-1.5 text-white transition-colors hover:bg-red-700"
          >
            <PhoneOff className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setCompacta((valor) => !valor)}
            title={compacta ? 'Mostrar más' : 'Achicar'}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            {compacta ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {participantes.map((p) => {
          const yo = p.idSocket === miSocket
          const habla = hablando.includes(p.idSocket)
          const conectando = !yo && !conectados.includes(p.idSocket)
          return (
            <li
              key={p.idSocket}
              title={conectando ? `${p.nombre}: conectando el audio…` : p.nombre}
              className={`flex items-center gap-1 rounded-full py-0.5 pr-2 pl-0.5 text-[11px] ${
                habla ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'
              } ${conectando ? 'opacity-60' : ''}`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white ${
                  habla ? 'bg-emerald-500 ring-2 ring-emerald-300' : 'bg-slate-400'
                }`}
              >
                {iniciales(p.nombre)}
              </span>
              <span className="max-w-24 truncate">{yo ? 'Vos' : p.nombre}</span>
              {p.silenciado && <MicOff className="h-3 w-3 text-amber-600" />}
              {conectando && <Loader2 className="h-3 w-3 animate-spin" />}
            </li>
          )
        })}
      </ul>

      <div className="flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-1.5">
        <Bot className="h-3.5 w-3.5 shrink-0 text-violet-600" />
        <span className="flex-1 text-[11px] leading-snug text-violet-900">
          {escucha === 'error'
            ? 'Jarvis no te está escuchando.'
            : escucha === 'conectando'
              ? 'Conectando a Jarvis…'
              : JARVIS[jarvis]}
        </span>
        {(jarvis === 'pensando' || escucha === 'conectando') && (
          <Loader2 className="h-3 w-3 animate-spin text-violet-500" />
        )}
        {jarvis === 'escuchando' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" />}
        {jarvis === 'hablando' && (
          <button
            type="button"
            onClick={callarJarvis}
            title="Cortar la respuesta (solo para vos)"
            className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium text-violet-700 hover:bg-violet-100"
          >
            <Square className="h-2.5 w-2.5" />
            Callar
          </button>
        )}
        {escucha === 'error' && (
          <button
            type="button"
            onClick={reintentarEscucha}
            title={errorEscucha ?? undefined}
            className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium text-violet-700 hover:bg-violet-100"
          >
            <RotateCw className="h-2.5 w-2.5" />
            Reintentar
          </button>
        )}
      </div>

      {!compacta && (
        <>
          <Votacion />

          {registro.length > 0 ? (
            <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-1">
              {registro.map((entrada) => (
                <Linea key={entrada.id} entrada={entrada} />
              ))}
              <li ref={finDeRegistro} aria-hidden />
            </ul>
          ) : (
            <p className="text-[11px] leading-snug text-slate-400">
              Lo que hablan entre ustedes no se guarda. Solo lo que empieza por "Jarvis" llega a la
              IA, y queda en el chat con su respuesta. Con auriculares no hay eco.
            </p>
          )}
        </>
      )}
    </div>
  )
}
